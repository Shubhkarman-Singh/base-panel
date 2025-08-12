/**
 * API Key Migration Script
 * Converts existing plain-text API keys to hashed format
 */

const { db } = require("../handlers/db.js");
const { hashApiKey } = require("./apiKeySecurity.js");
const log = new (require("cat-loggr"))();

/**
 * Migrate existing API keys to new secure format
 */
async function migrateApiKeys() {
  try {
    log.info("Starting API key migration...");
    
    const apiKeys = (await db.get("apiKeys")) || [];
    
    if (apiKeys.length === 0) {
      log.info("No API keys found to migrate");
      return;
    }

    let migratedCount = 0;
    const migratedKeys = apiKeys.map(key => {
      // Check if key is already in new format (has metadata fields)
      if (key.id && key.createdAt && key.expiresAt) {
        return key; // Already migrated
      }

      // Migrate old format key
      const plainKey = key.key;
      const hashedKey = hashApiKey(plainKey);
      
      const migratedKey = {
        id: require('crypto').randomUUID(),
        name: key.name || `Legacy Key ${migratedCount + 1}`,
        key: hashedKey, // Store hashed version
        userId: key.userId || 'system',
        permissions: key.permissions || ['*'], // Grant full permissions to legacy keys
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(), // 1 year from now
        lastUsed: null,
        isActive: true,
        usageCount: 0,
        migrated: true,
        originalKey: plainKey // Store temporarily for admin reference
      };

      migratedCount++;
      return migratedKey;
    });

    if (migratedCount > 0) {
      await db.set("apiKeys", migratedKeys);
      log.info(`Successfully migrated ${migratedCount} API keys to secure format`);
      
      // Log the original keys for admin reference (they should save these)
      const originalKeys = migratedKeys
        .filter(key => key.migrated && key.originalKey)
        .map(key => ({
          id: key.id,
          name: key.name,
          originalKey: key.originalKey
        }));

      if (originalKeys.length > 0) {
        log.warn("IMPORTANT: Original API keys for reference (save these and update your applications):");
        originalKeys.forEach(key => {
          log.warn(`Key ID: ${key.id}, Name: ${key.name}, Original Key: ${key.originalKey}`);
        });
      }
    } else {
      log.info("All API keys are already in the new secure format");
    }

  } catch (error) {
    log.error("Error during API key migration:", error);
    throw error;
  }
}

/**
 * Clean up migration data (remove original keys from storage)
 */
async function cleanupMigrationData() {
  try {
    const apiKeys = (await db.get("apiKeys")) || [];
    
    const cleanedKeys = apiKeys.map(key => {
      if (key.originalKey) {
        const { originalKey, ...cleanedKey } = key;
        return cleanedKey;
      }
      return key;
    });

    await db.set("apiKeys", cleanedKeys);
    log.info("Migration cleanup completed - original keys removed from storage");
  } catch (error) {
    log.error("Error during migration cleanup:", error);
    throw error;
  }
}

module.exports = {
  migrateApiKeys,
  cleanupMigrationData
};