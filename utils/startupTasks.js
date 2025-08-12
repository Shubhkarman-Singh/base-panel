/**
 * Production Startup Tasks
 * Handles initialization, migration, and cleanup tasks
 */

const { migrateApiKeys, cleanupMigrationData } = require("./migrateApiKeys.js");
const { cleanupExpiredKeys } = require("./apiKeySecurity.js");
const { cleanupSecurityLogs } = require("./securityLogger.js");
const { productionReadinessCheck } = require("./securityTest.js");
const log = new (require("cat-loggr"))();

/**
 * Run all startup tasks
 */
async function runStartupTasks() {
    log.info("Running startup tasks...");

    try {
        // 1. Migrate API keys to secure format
        await migrateApiKeys();

        // 2. Clean up expired API keys
        await cleanupExpiredKeys();

        // 3. Clean up old security logs (keep 90 days)
        await cleanupSecurityLogs(90);

        // 4. Run production readiness check
        const isReady = await productionReadinessCheck();
        if (!isReady) {
            log.warn("Production readiness check failed - some features may not work correctly");
        }

        // 5. Clean up migration data after 24 hours
        setTimeout(async () => {
            try {
                await cleanupMigrationData();
                log.info("Migration cleanup completed");
            } catch (error) {
                log.error("Migration cleanup failed:", error);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours

        log.info("Startup tasks completed successfully");

    } catch (error) {
        log.error("Startup tasks failed:", error);
        throw error;
    }
}

/**
 * Schedule periodic maintenance tasks
 */
function scheduleMaintenanceTasks() {
    // Clean up expired API keys every 6 hours
    setInterval(async () => {
        try {
            const cleaned = await cleanupExpiredKeys();
            if (cleaned > 0) {
                log.info(`Maintenance: Cleaned up ${cleaned} expired API keys`);
            }
        } catch (error) {
            log.error("API key cleanup maintenance failed:", error);
        }
    }, 6 * 60 * 60 * 1000); // 6 hours

    // Clean up old security logs daily
    setInterval(async () => {
        try {
            const cleaned = await cleanupSecurityLogs(90);
            if (cleaned > 0) {
                log.info(`Maintenance: Cleaned up ${cleaned} old security log entries`);
            }
        } catch (error) {
            log.error("Security log cleanup maintenance failed:", error);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours

    log.info("Maintenance tasks scheduled");
}

module.exports = {
    runStartupTasks,
    scheduleMaintenanceTasks
};