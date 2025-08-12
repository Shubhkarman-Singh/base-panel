/**
 * @fileoverview This module sets up the authentication routes using Passport for user
 * authentication with a local strategy. It handles user login, logout, and registration processes.
 * User credentials are verified against a custom database handler, and sessions are managed
 * through Passport's session handling.
 */

const express = require("express");
const passport = require("passport");
const log = new (require("cat-loggr"))();
const LocalStrategy = require("passport-local").Strategy;
const { v4: uuidv4 } = require("uuid");
const { db } = require("../../handlers/db.js");
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("../../handlers/email.js");
const speakeasy = require("speakeasy");
const bcrypt = require("bcrypt");
const { verifyCaptcha } = require("../../utils/captchaMiddleware");
const { validateRegistration, validateLogin } = require("../../utils/inputValidation");
const { PasswordResetSecurity } = require("../../utils/passwordResetSecurity");
const saltRounds = 10;

const router = express.Router();

/**
 * Simplified middleware to ensure proper auth flow
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const enforceAuthFlow = (req, res, next) => {
  // If user is already authenticated, redirect to instances
  if (req.user) {
    return res.redirect('/instances');
  }

  // Always allow access to login/register pages
  // The main /auth route will handle starting the auth flow
  return next();
};

// Main auth page - starts the auth flow
router.get('/auth', async (req, res) => {
  if (req.user) {
    return res.redirect('/instances');
  }

  try {
    // Start auth flow with proper session handling
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).send('Internal Server Error');
      }

      // Set session variables
      req.session.authFlow = 'started';
      req.session.cookie.maxAge = 30 * 60 * 1000; // 30 minutes

      // Save the session before sending the response
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).send('Internal Server Error');
        }

        // Now render the page with the session properly set
        db.get("settings").then(settings => {
          settings = settings || {};
          res.render('auth/auth', {
            settings,
            req,
            registrationEnabled: settings.register === true,
            _csrf: req.csrfToken ? req.csrfToken() : ''
          });
        }).catch(err => {
          console.error('Error fetching settings:', err);
          res.status(500).send('Internal Server Error');
        });
      });
    });
  } catch (error) {
    console.error('Error in /auth route:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Clear auth flow on logout
router.get('/auth/logout', (req, res) => {
  if (req.session) {
    req.session.authFlow = null;
  }
  req.logout(() => {
    res.redirect('/auth');
  });
});

/**
 * Configures Passport's local strategy for user authentication. It checks the provided
 * username (or email) and password against stored credentials in the database. If the credentials
 * match, the user is authenticated; otherwise, appropriate error messages are returned.
 *
 * @returns {void} No return value but configures the local authentication strategy.
 */
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const settings = (await db.get("settings")) || {};
      const users = await db.get("users");
      if (!users) {
        return done(null, false, { message: "No users found." });
      }

      const isEmail = username.includes("@");

      let user;
      if (isEmail) {
        user = users.find((user) => user.email === username);
      } else {
        user = users.find((user) => user.username === username);
      }

      if (!user) {
        return done(null, false, { message: "Incorrect username or email." });
      }

      if (!user.verified && (settings.emailVerification || false)) {
        return done(null, false, {
          message: "Email not verified. Please verify your email.",
          userNotVerified: true,
        });
      }

      const match = await bcrypt.compare(password, user.password);
      if (match) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Incorrect password." });
      }
    } catch (error) {
      return done(error);
    }
  })
);

async function doesUserExist(username) {
  const users = await db.get("users");
  if (users) {
    return users.some((user) => user.username === username);
  } else {
    return false; // If no users found, return false
  }
}

async function doesEmailExist(email) {
  const users = await db.get("users");
  if (users) {
    return users.some((user) => user.email === email);
  } else {
    return false; // If no users found, return false
  }
}

async function createUser(username, email, password) {
  const settings = (await db.get("settings")) || {};
  const emailVerificationEnabled = settings.emailVerification || false;

  if (emailVerificationEnabled) {
    return addUserToUsersTable(username, email, password, false);
  } else {
    return addUserToUsersTable(username, email, password, true);
  }
}

async function addUserToUsersTable(username, email, password, verified) {
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userId = uuidv4();
    const verificationToken = verified ? null : generateRandomCode(30);
    let users = (await db.get("users")) || [];
    const newUser = {
      userId,
      username,
      email,
      password: hashedPassword,
      accessTo: [],
      admin: false,
      welcomeEmailSent: false,
      verified,
      verificationToken,
    };
    users.push(newUser);
    await db.set("users", users);

    if (!newUser.welcomeEmailSent) {
      await sendWelcomeEmail(email, username);
      newUser.welcomeEmailSent = true;

      if (!verified) {
        await sendVerificationEmail(email, verificationToken);
        users = (await db.get("users")) || [];
        const index = users.findIndex((u) => u.userId === newUser.userId);
        if (index !== -1) {
          users[index] = newUser;
          await db.set("users", users);
        }
      }
    }

    return users;
  } catch (error) {
    log.error("Error adding user to database:", error);
    throw error;
  }
}

/**
 * Serializes the user to the session, storing only the username to manage login sessions.
 * @param {Object} user - The user object from the database.
 * @param {Function} done - A callback function to call with the username.
 */
passport.serializeUser((user, done) => {
  done(null, user.username);
});

/**
 * Deserializes the user from the session by retrieving the full user details from the database
 * using the stored username. Necessary for loading user details on subsequent requests after login.
 * @param {string} username - The username stored in the session.
 * @param {Function} done - A callback function to call with the user object or errors if any.
 */
passport.deserializeUser(async (username, done) => {
  try {
    const users = await db.get("users");
    if (!users) {
      throw new Error("User not found");
    }

    // Search for the user with the provided username in the users array
    const user = users.find((user) => user.username === username);

    if (!user) {
      throw new Error("User not found");
    }

    done(null, user); // Deserialize user by retrieving full user details from the database
  } catch (error) {
    done(error);
  }
});

/**
 * GET /auth/login
 * Authenticates a user using Passport's local strategy. If authentication is successful, the user
 * is redirected to the instances page, otherwise, they are sent back to the login page with an error.
 *
 * @returns {Response} Redirects based on the success or failure of the authentication attempt.
 */
router.get("/auth/login", async (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      if (info.userNotVerified) {
        return res.redirect("/login?err=UserNotVerified");
      }
      return res.redirect("/login?err=InvalidCredentials&state=failed");
    }
    req.logIn(user, async (err) => {
      if (err) return next(err);

      const users = await db.get("users");
      const user2 = users.find((u) => u.username === user.username);

      if (user2 && user2.twoFAEnabled) {
        req.session.tempUser = user;
        req.user = null;
        return res.redirect("/2fa");
      } else {
        return res.redirect("/instances");
      }
    });
  })(req, res, next);
});

router.post(
  "/auth/login",
  validateLogin,
  verifyCaptcha,
  passport.authenticate("local", {
    failureRedirect: "/login?err=InvalidCredentials&state=failed",
  }),
  async (req, res, next) => {
    try {
      if (req.user) {
        const users = await db.get("users");
        const user = users.find((u) => u.username === req.user.username);

        if (user && user.verified) {
          return res.redirect("/instances");
        }

        if (user && user.twoFAEnabled) {
          req.session.tempUser = req.user;
          req.logout((err) => {
            if (err) return next(err);

            return res.redirect("/2fa");
          });
        } else {
          return res.redirect("/instances");
        }
      } else {
        return res.redirect("/login?err=InvalidCredentials&state=failed");
      }
    } catch (error) {
      log.error("Error during login:", error);
      return res.status(500).send("Internal Server Error");
    }
  }
);

router.get("/2fa", async (req, res) => {
  if (!req.session.tempUser) {
    return res.redirect("/login");
  }
  const settings = (await db.get("settings")) || {};
  res.render("auth/2fa", {
    req,
    settings,
  });
});

router.post("/2fa", async (req, res) => {
  const { token } = req.body;
  const tempUser = req.session.tempUser;

  if (!tempUser) {
    return res.redirect("/login");
  }

  const users = await db.get("users");
  const user = users.find((user) => user.username === tempUser.username);

  const verified = speakeasy.totp.verify({
    secret: user.twoFASecret,
    encoding: "base32",
    token,
  });

  if (verified) {
    req.login(tempUser, (err) => {
      if (err) return next(err);

      req.session.tempUser = null;
      return res.redirect("/instances");
    });
  } else {
    return res.status(400).redirect("/2fa?err=InvalidAuthCode");
  }
});

router.get(
  "/auth/login",
  passport.authenticate("local", {
    successRedirect: "/instances",
    failureRedirect: "/login?err=InvalidCredentials&state=failed",
  })
);

router.get("/verify/:token", async (req, res) => {
  const { token } = req.params;
  try {
    let users = (await db.get("users")) || [];
    const user = users.find((u) => u.verificationToken === token);
    if (user) {
      user.verified = true;
      user.verificationToken = null;
      await db.set("users", users);
      res.redirect("/login?msg=EmailVerified");
    } else {
      res.redirect("/login?msg=InvalidVerificationToken");
    }
  } catch (error) {
    log.error("Error verifying email:", error);
    res.status(500).send("Internal server error");
  }
});

router.get("/resend-verification", async (req, res) => {
  const settings = (await db.get("settings")) || {};
  try {
    res.render("auth/resend-verification", {
      req,
      settings,
    });
  } catch (error) {
    log.error("Error fetching name or logo:", error);
    res.status(500).send("Internal server error");
  }
});

router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  try {
    let users = (await db.get("users")) || [];
    const userIndex = users.findIndex((u) => u.email === email);

    if (userIndex === -1) {
      res.redirect("/login?msg=UserNotFound");
      return;
    }

    const user = users[userIndex];

    if (user.verified) {
      res.redirect("/login?msg=UserAlreadyVerified");
      return;
    }
    const newVerificationToken = generateRandomCode(30);
    user.verificationToken = newVerificationToken;

    users[userIndex] = user;
    await db.set("users", users);

    await sendVerificationEmail(email, newVerificationToken);

    res.redirect("/login?msg=VerificationEmailResent");
  } catch (error) {
    log.error("Error resending verification email:", error);
    res.status(500).send("Internal server error");
  }
});

router.get("/", (req, res) => {
  if (req.user) {
    res.redirect("/instances");
  } else {
    res.redirect("/auth");
  }
});

router.get("/login", enforceAuthFlow, async (req, res) => {
  const settings = (await db.get("settings")) || {};
  res.render("auth/login", {
    req,
    settings,
    user: null, // Explicitly set to null for security
    layout: 'layouts/auth'
  });
});

async function initializeRoutes() {
  async function updateRoutes() {
    try {
      const settings = await db.get("settings");

      if (!settings) {
        db.set("settings", { register: false });
      } else {
        if (settings.register === true) {
          router.get("/register", enforceAuthFlow, async (req, res) => {
            if (req.user) return res.redirect("/");
            const settings = (await db.get("settings")) || {};
            try {
              res.render("auth/register", {
                settings,
                req,
                user: null, // Explicitly set to null for security
                layout: 'layouts/auth'
              });
            } catch (error) {
              log.error("Error fetching name or logo:", error);
              res.status(500).send("Internal server error");
            }
          });

          router.post("/auth/register", validateRegistration, verifyCaptcha, async (req, res) => {
            const { username, email, password } = req.body;

            try {
              const userExists = await doesUserExist(username);
              const emailExists = await doesEmailExist(email);

              if (userExists || emailExists) {
                res.send("User already exists");
                return;
              }

              const settings = (await db.get("settings")) || {};
              const emailVerificationEnabled =
                settings.emailVerification || false;

              if (emailVerificationEnabled) {
                await createUser(username, email, password);
                res.redirect("/login?msg=AccountcreateEmailSent");
              } else {
                await addUserToUsersTable(username, email, password, true);
                res.redirect("/login?msg=AccountCreated");
              }
            } catch (error) {
              log.error("Error handling registration:", error);
              res.status(500).send("Internal server error");
            }
          });
        } else {
          router.stack = router.stack.filter(
            (r) =>
              !(
                r.route &&
                (r.route.path === "/register" ||
                  r.route.path === "/auth/register")
              )
          );
        }
      }
    } catch (error) {
      log.error("Error initializing routes:", error);
    }
  }
  await updateRoutes();
  setInterval(updateRoutes, 1000);
}

initializeRoutes();

router.get("/auth", async (req, res) => {
  const settings = (await db.get("settings")) || {};
  res.render("auth", {
    settings,
    req,
    title: "Authentication",
    layout: "layouts/auth"
  });
});

router.get("/auth/reset-password", async (req, res) => {
  const settings = (await db.get("settings")) || {};
  try {
    res.render("auth/reset-password", {
      req,
      settings,
    });
  } catch (error) {
    log.error("Error rendering reset password page:", error);
    res.status(500).send("Internal server error");
  }
});

router.post("/auth/reset-password", verifyCaptcha, async (req, res) => {
  const { email } = req.body;

  // Validate email format
  const { InputValidator } = require("../../utils/inputValidation");
  const emailValidation = InputValidator.validateEmail(email);
  if (!emailValidation.isValid) {
    return res.redirect("/auth/reset-password?err=InvalidEmail");
  }

  try {
    const users = (await db.get("users")) || [];
    const user = users.find((u) => u.email === emailValidation.sanitized);

    if (!user) {
      // Don't reveal if email exists or not for security
      res.redirect("/auth/reset-password?msg=PasswordSent");
      return;
    }

    // Generate secure token with expiration
    const tokenData = PasswordResetSecurity.generateResetToken();
    const resetToken = await PasswordResetSecurity.storeResetToken(emailValidation.sanitized, tokenData);

    await sendPasswordResetEmail(emailValidation.sanitized, resetToken);

    res.redirect("/auth/reset-password?msg=PasswordSent");
  } catch (error) {
    log.error("Error handling password reset:", error);
    res.redirect("/auth/reset-password?msg=PasswordResetFailed");
  }
});

router.get("/auth/reset/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // Validate token using secure system
    const validation = await PasswordResetSecurity.validateResetToken(token);

    if (!validation.valid) {
      log.warn(`Invalid password reset attempt with token: ${token}, error: ${validation.error}`);
      return res.render("auth/password-reset-error", {
        req,
        error: validation.error,
        settings: (await db.get("settings")) || {}
      });
    }

    const settings = (await db.get("settings")) || {};
    res.render("auth/password-reset-form", {
      req,
      token: token,
      settings,
      user: validation.user
    });
  } catch (error) {
    log.error("Error rendering password reset form:", error);
    res.status(500).send("Internal server error");
  }
});

router.post("/auth/reset/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    // Validate password complexity
    const { InputValidator } = require("../../utils/inputValidation");
    const passwordValidation = InputValidator.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.redirect(`/auth/reset/${token}?err=${encodeURIComponent(passwordValidation.errors.join('; '))}`);
    }

    // Validate token using secure system
    const validation = await PasswordResetSecurity.validateResetToken(token);

    if (!validation.valid) {
      log.warn(`Invalid password reset attempt with token: ${token}, error: ${validation.error}`);
      return res.redirect("/login?msg=PasswordReset&state=failed");
    }

    // Mark token as used immediately to prevent reuse
    await PasswordResetSecurity.markTokenAsUsed(token);

    // Update password
    const users = (await db.get("users")) || [];
    const userIndex = users.findIndex(u => u.email === validation.user.email);

    if (userIndex === -1) {
      throw new Error("User not found during password update");
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    users[userIndex].password = hashedPassword;
    await db.set("users", users);

    // Clear the reset token completely
    await PasswordResetSecurity.clearResetToken(token);

    log.info(`Password successfully reset for user: ${validation.user.email}`);
    res.redirect("/login?msg=PasswordReset&state=success");
  } catch (error) {
    log.error("Error handling password reset:", error);
    res.redirect("/login?msg=PasswordReset&state=failed");
  }
});

function generateRandomCode(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * GET /auth/logout
 * Logs out the user by ending the session and then redirects the user.
 *
 * @returns {Response} No specific return value but ends the user's session and redirects.
 */
router.get("/auth/logout", (req, res) => {
  req.logout(req.user, (err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

initializeRoutes().catch((error) => {
  log.error("Error initializing routes:", error);
});

module.exports = router;
