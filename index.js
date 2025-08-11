/*
 *  _                      _          
 * (_)_ __ ___  _ __  _   _| |___  ___ 
 * | | '_ ` _ \| '_ \| | | | / __|/ _ \
 * | | | | | | | |_) | |_| | \__ \  __/
 * |_|_| |_| |_| .__/ \__,_|_|___/\___|
 *             |_|                    
 *
 *  Impulse Panel 0.3.0 (Oz)
 *  (c) 2024 Impulse OSS and contributors
 *
 */

/**
 * @fileoverview Main server file for Impulse Panel. Sets up the express application,
 * configures middleware for sessions, body parsing, and websocket enhancements, and dynamically loads route
 * modules. This file also sets up the server to listen on a configured port and initializes logging.
 */

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const bodyParser = require("body-parser");
const fs = require("node:fs");
const config = require("./config.json");
const ascii = fs.readFileSync("./handlers/ascii.txt", "utf8");
const app = express();
const path = require("path");
const chalk = require("chalk");
const expressWs = require("express-ws")(app);
const { db } = require("./handlers/db.js");
const translationMiddleware = require("./handlers/translation");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { createLoginLimiter, createPasswordResetLimiter } = require("./utils/advancedRateLimit.js");
const theme = require("./storage/theme.json");
const analytics = require("./utils/analytics.js");
const crypto = require("node:crypto");

const sqlite = require("better-sqlite3");
const SqliteStore = require("better-sqlite3-session-store")(session);
const sessionStorage = new sqlite("sessions.db");
const { loadPlugins } = require("./plugins/loadPls.js");
let plugins = loadPlugins(path.join(__dirname, "./plugins"));
plugins = Object.values(plugins).map((plugin) => plugin.config);

const { init } = require("./handlers/init.js");

const log = new (require("cat-loggr"))();

app.use(
  session({
    store: new SqliteStore({
      client: sessionStorage,
      expired: {
        clear: true,
        intervalMs: 9000000,
      },
    }),
    secret: config.session_secret || generateRandomString(64),
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
      secure: config.mode === 'production', // Require HTTPS in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' // CSRF protection
    }
  })
);

/**
 * Initializes the Express application with necessary middleware for parsing HTTP request bodies,
 * handling sessions, and integrating WebSocket functionalities. It sets EJS as the view engine,
 * reads route files from the 'routes' directory, and applies WebSocket enhancements to each route.
 * Finally, it sets up static file serving and starts listening on a specified port.
 */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(analytics);
app.use(translationMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Comprehensive rate limiting configuration
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: "15 minutes"
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for API endpoints
  message: {
    error: "API rate limit exceeded, please try again later.",
    retryAfter: "15 minutes"
  },
});

const strictRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Very strict for sensitive operations
  message: {
    error: "Rate limit exceeded for sensitive operation, please try again later.",
    retryAfter: "1 minute"
  },
});

// Apply general rate limiting to all requests
app.use(generalRateLimiter);

// Password reset rate limiter - very strict
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset attempts per hour per IP
  message: {
    error: "Too many password reset attempts, please try again later.",
    retryAfter: "1 hour"
  },
  skipSuccessfulRequests: false, // Count all attempts
});

// Apply specific rate limiting to auth routes
app.use('/auth', authRateLimiter);
app.use('/login', authRateLimiter);
app.use('/register', authRateLimiter);
app.use('/2fa', authRateLimiter);

// Apply advanced login rate limiting with exponential backoff
app.use('/auth/login', createLoginLimiter());
app.use('/login', createLoginLimiter());

// Apply password reset rate limiting
app.use('/auth/reset-password', createPasswordResetLimiter());
app.use('/change-password', passwordResetLimiter);

// Apply API rate limiting
app.use('/api', apiRateLimiter);

// Apply strict rate limiting to sensitive admin operations
app.use('/admin/users/create', strictRateLimiter);
app.use('/admin/users/delete', strictRateLimiter);
app.use('/admin/settings', strictRateLimiter);

// Apply strict rate limiting to account operations
app.use('/update-username', strictRateLimiter);
app.use('/verify-2fa', strictRateLimiter);
app.use('/disable-2fa', strictRateLimiter);

/**
 * Generates a cryptographically secure random string.
 *
 * @param {number} length - The length of the string to generate (minimum 32 for session secrets).
 * @returns {string} - The generated hexadecimal string.
 */
function generateRandomString(length) {
  // Ensure minimum length for security
  const minLength = Math.max(length, 32);
  
  // Generate cryptographically secure random bytes
  return crypto.randomBytes(minLength).toString('hex');
}

/**
 * Recursively traverses an object and replaces any value that is exactly "random"
 * with a randomly generated string.
 *
 * @param {Object} obj - The object to traverse.
 */
function replaceRandomValues(obj) {
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      replaceRandomValues(obj[key]);
    } else if (obj[key] === "Random") {
      // Generate longer, more secure strings for session secrets
      if (key === "session_secret") {
        obj[key] = generateRandomString(64); // 64-byte hex string for session secrets
      } else {
        obj[key] = generateRandomString(32); // 32-byte hex string for other secrets
      }
    }
  }
}

/**
 * Updates the config.json file by replacing "random" values with random strings.
 */
async function updateConfig() {
  const configPath = "./config.json";

  try {
    let configData = fs.readFileSync(configPath, "utf8");
    let config = JSON.parse(configData);

    replaceRandomValues(config);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    log.error("Error updating config:", error);
  }
}

updateConfig();

function getLanguages() {
  return fs.readdirSync(__dirname + "/lang").map((file) => file.split(".")[0]);
}

app.get("/setLanguage", async (req, res) => {
  const lang = req.query.lang;
  if (lang && getLanguages().includes(lang)) {
    res.cookie("lang", lang, {
      maxAge: 90000000,
      httpOnly: true,
      sameSite: "strict",
    });
    req.user.lang = lang;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

const { getUserAvatarUrl } = require("./handlers/avatarHelper");
const { formatBytes, formatDiskUsage, formatMemory, formatSpeed } = require("./utils/unitHelper");
const { enforce2FA } = require("./utils/twoFAEnforcement");
const { getLogoProperties } = require("./handlers/logoHelper");
const { addCaptchaToLocals } = require("./utils/captchaMiddleware");

app.use(async (req, res, next) => {
  try {
    const settings = (await db.get("settings")) || {};
    const captchaSettings = (await db.get("captcha_settings")) || {};

    res.locals.languages = getLanguages();
    res.locals.ogTitle = config.ogTitle;
    res.locals.ogDescription = config.ogDescription;
    res.locals.footer = settings.footer || "";
    res.locals.theme = theme;
    res.locals.name = settings.name || "Impulse";
    res.locals.logo = settings.logo !== undefined ? settings.logo : true; // Default to true if not set
    res.locals.plugins = plugins;
    res.locals.settings = settings; // Make settings available to all views
    res.locals.captchaSettings = captchaSettings; // Make captcha settings available to all views
    
    // Add avatar helper function to views
    res.locals.getUserAvatarUrl = (user) => getUserAvatarUrl(user, settings);
    
    // Add unit formatting helpers to views
    res.locals.formatBytes = (bytes, decimals) => formatBytes(bytes, settings, decimals);
    res.locals.formatDiskUsage = (used, total) => formatDiskUsage(used, total, settings);
    res.locals.formatMemory = (memory) => formatMemory(memory, settings);
    res.locals.formatSpeed = (speed) => formatSpeed(speed, settings);
    
    // Add logo helper to views
    res.locals.logoProperties = getLogoProperties(settings);
    
    next();
  } catch (error) {
    // If there's an error, use default values
    res.locals.name = "Impulse";
    res.locals.logo = true;
    res.locals.settings = {};
    res.locals.captchaSettings = {};
    next();
  }
});

if (config.mode === "production" || false) {
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "5");
    next();
  });

  app.use("/assets", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=1");
    next();
  });
}

app.set("view engine", "ejs");
/**
 * Configures the Express application to serve static files from the 'public' directory, providing
 * access to client-side resources like images, JavaScript files, and CSS stylesheets without additional
 * routing. The server then starts listening on a port defined in the configuration file, logging the port
 * number to indicate successful startup.
 */
app.use(express.static("public"));

/**
 * Dynamically loads all route modules from the 'routes' directory, applying WebSocket support to each.
 * Logs the loaded routes and mounts them to the Express application under the root path. This allows for
 * modular route definitions that can be independently maintained and easily scaled.
 */

// Add 2FA enforcement middleware
app.use(enforce2FA);

const routesDir = path.join(__dirname, "routes");
function loadRoutes(directory) {
  fs.readdirSync(directory).forEach((file) => {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadRoutes(fullPath);
    } else if (stat.isFile() && path.extname(file) === ".js") {
      const route = require(fullPath);
      expressWs.applyTo(route);

      if (fullPath.includes(path.join("routes", "Admin"))) {
        app.use("/", route);
      } else {
        app.use("/", route);
      }
    }
  });
}
loadRoutes(routesDir);

// Plugin routes and views
const pluginRoutes = require("./plugins/pluginManager.js");
app.use("/", pluginRoutes);
const pluginDir = path.join(__dirname, "plugins");
const PluginViewsDir = fs
  .readdirSync(pluginDir)
  .map((addonName) => path.join(pluginDir, addonName, "views"));
app.set("views", [path.join(__dirname, "views"), ...PluginViewsDir]);

// Init
init();

console.log(chalk.gray(ascii) + chalk.white(`version v${config.version}\n`));
app.listen(config.port, () =>
  log.info(`Impulse is listening on port ${config.port}`)
);

app.get("*", async function (req, res) {
  res.render("errors/404", {
    req,
    name: (await db.get("name")) || "Impulse",
  });
});
