const configManager = require("../utils/configManager");
const log = require("../utils/secureLogger");

// Validate configuration on startup
try {
  configManager.validateConfig();
} catch (error) {
  log.error("Database configuration validation failed:", error);
  throw error;
}

const dbConfig = configManager.getDatabaseConfig();

if (!dbConfig.url) {
  throw new Error("Database URL not configured. Check your .env file or environment variables.");
}

let db;

try {
  if (dbConfig.type === "sqlite") {
    const Keyv = require("keyv");
    db = new Keyv(dbConfig.url);
    log.info("Connected to SQLite database");
  } else if (dbConfig.type === "mysql") {
    const Keyv = require("@keyvhq/core");
    const KeyvMysql = require("@keyvhq/mysql");

    const mysqlConfig = {
      url: dbConfig.url,
      table: configManager.get("databaseTable") || "impulse",
      keySize: 255,
    };

    db = new Keyv({
      store: new KeyvMysql(mysqlConfig.url, {
        table: mysqlConfig.table,
        keySize: mysqlConfig.keySize,
      }),
    });
    
    log.info(`Connected to MySQL database at ${dbConfig.host}:${dbConfig.port}`);
  } else {
    throw new Error(`Unsupported database type: ${dbConfig.type}`);
  }
} catch (error) {
  log.error("Failed to initialize database connection:", error);
  throw new Error(`Database connection failed: ${error.message}`);
}

module.exports = { db };
