/**
 * Enhanced API Key Security System
 * Provides secure API key generation, validation, and management
 */

const crypto = require('crypto');
const { db } = require("../handlers/db.js");
const log = new (require("cat-loggr"))();
const { logSecurityEvent, SECURITY_EVENTS } = require("./securityLogger.js");

/**
 * Generate a cryptographically secure API key
 * @param {number} length - Length of the API key (default: 64)
 * @returns {string} Secure API key
 */
function generateSecureApiKey(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash API key for secure storage
 * @param {string} apiKey - Plain text API key
 * @returns {string} Hashed API key
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create a new API key with metadata
 * @param {string} name - Name/description for the API key
 * @param {string} userId - User ID who created the key
 * @param {Array} permissions - Array of permissions for this key
 * @param {number} expiresInDays - Days until expiration (default: 365)
 * @returns {Object} API key object with metadata
 */
async function createApiKey(name, userId, permissions = [], expiresInDays = 365) {
  const plainKey = generateSecureApiKey();
  const hashedKey = hashApiKey(plainKey);
  const keyId = crypto.randomUUID();
  
  const apiKeyObject = {
    id: keyId,
    name: name,
    key: hashedKey, // Store hashed version
    userId: userId,
    permissions: permissions,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)).toISOString(),
    lastUsed: null,
    isActive: true,
    usageCount: 0
  };

  // Store in database
  const apiKeys = (await db.get("apiKeys")) || [];
  apiKeys.push(apiKeyObject);
  await db.set("apiKeys", apiKeys);

  // Log API key creation
  log.info(`API key created: ${keyId} by user ${userId}`);
  logSecurityEvent(SECURITY_EVENTS.API_KEY_CREATED, userId, null, {
    keyId: keyId,
    keyName: name,
    permissions: permissions,
    expiresAt: apiKeyObject.expiresAt
  }, 'medium');

  // Return the plain key only once (for user to save)
  return {
    id: keyId,
    key: plainKey, // Return plain key for user to save
    name: name,
    permissions: permissions,
    expiresAt: apiKeyObject.expiresAt
  };
}

/**
 * Enhanced API key validation middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const clientIP = req.ip || req.connection.remoteAddress;

  if (!apiKey) {
    log.warn(`API request without key from IP: ${clientIP}`);
    return res.status(401).json({ 
      error: "API key is required",
      code: "MISSING_API_KEY"
    });
  }

  try {
    const hashedKey = hashApiKey(apiKey);
    const apiKeys = (await db.get("apiKeys")) || [];
    const validKey = apiKeys.find((key) => key.key === hashedKey && key.isActive);

    if (!validKey) {
      log.warn(`Invalid API key attempt from IP: ${clientIP}`);
      logSecurityEvent(SECURITY_EVENTS.API_KEY_INVALID, null, clientIP, {
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      }, 'high');
      
      return res.status(401).json({ 
        error: "Invalid API key",
        code: "INVALID_API_KEY"
      });
    }

    // Check if key is expired
    if (new Date() > new Date(validKey.expiresAt)) {
      log.warn(`Expired API key used: ${validKey.id} from IP: ${clientIP}`);
      logSecurityEvent(SECURITY_EVENTS.API_KEY_EXPIRED, validKey.userId, clientIP, {
        keyId: validKey.id,
        keyName: validKey.name,
        expiresAt: validKey.expiresAt,
        userAgent: req.get('User-Agent')
      }, 'medium');
      
      return res.status(401).json({ 
        error: "API key has expired",
        code: "EXPIRED_API_KEY"
      });
    }

    // Update last used timestamp and usage count
    validKey.lastUsed = new Date().toISOString();
    validKey.usageCount = (validKey.usageCount || 0) + 1;
    await db.set("apiKeys", apiKeys);

    // Attach key metadata to request
    req.apiKey = {
      id: validKey.id,
      name: validKey.name,
      userId: validKey.userId,
      permissions: validKey.permissions
    };

    log.info(`API key used: ${validKey.id} from IP: ${clientIP}`);
    next();
  } catch (error) {
    log.error("Error validating API key:", error);
    res.status(500).json({ 
      error: "Failed to validate API key",
      code: "VALIDATION_ERROR"
    });
  }
}

/**
 * Check if API key has specific permission
 * @param {Array} requiredPermissions - Required permissions
 * @returns {Function} Middleware function
 */
function requireApiPermission(requiredPermissions) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ 
        error: "API key validation required",
        code: "NO_API_KEY"
      });
    }

    const hasPermission = requiredPermissions.every(permission => 
      req.apiKey.permissions.includes(permission) || req.apiKey.permissions.includes('*')
    );

    if (!hasPermission) {
      log.warn(`API key ${req.apiKey.id} lacks required permissions: ${requiredPermissions.join(', ')}`);
      logSecurityEvent(SECURITY_EVENTS.PERMISSION_DENIED, req.apiKey.userId, req.ip, {
        keyId: req.apiKey.id,
        keyName: req.apiKey.name,
        requiredPermissions: requiredPermissions,
        grantedPermissions: req.apiKey.permissions,
        endpoint: req.originalUrl
      }, 'medium');
      
      return res.status(403).json({ 
        error: "Insufficient API key permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        required: requiredPermissions,
        granted: req.apiKey.permissions
      });
    }

    next();
  };
}

/**
 * Revoke an API key
 * @param {string} keyId - API key ID to revoke
 * @param {string} userId - User ID requesting revocation
 * @returns {boolean} Success status
 */
async function revokeApiKey(keyId, userId) {
  try {
    const apiKeys = (await db.get("apiKeys")) || [];
    const keyIndex = apiKeys.findIndex(key => key.id === keyId);
    
    if (keyIndex === -1) {
      return false;
    }

    const key = apiKeys[keyIndex];
    
    // Only allow key owner or admin to revoke
    if (key.userId !== userId) {
      const users = (await db.get("users")) || [];
      const user = users.find(u => u.userId === userId);
      if (!user || !user.admin) {
        return false;
      }
    }

    // Mark as inactive instead of deleting for audit trail
    apiKeys[keyIndex].isActive = false;
    apiKeys[keyIndex].revokedAt = new Date().toISOString();
    apiKeys[keyIndex].revokedBy = userId;
    
    await db.set("apiKeys", apiKeys);
    log.info(`API key revoked: ${keyId} by user ${userId}`);
    logSecurityEvent(SECURITY_EVENTS.API_KEY_REVOKED, userId, null, {
      keyId: keyId,
      keyName: key.name,
      revokedBy: userId
    }, 'medium');
    
    return true;
  } catch (error) {
    log.error("Error revoking API key:", error);
    return false;
  }
}

/**
 * Clean up expired API keys
 * @returns {number} Number of keys cleaned up
 */
async function cleanupExpiredKeys() {
  try {
    const apiKeys = (await db.get("apiKeys")) || [];
    const now = new Date();
    let cleanedCount = 0;

    const activeKeys = apiKeys.filter(key => {
      if (new Date(key.expiresAt) <= now && key.isActive) {
        key.isActive = false;
        key.expiredAt = now.toISOString();
        cleanedCount++;
        return true;
      }
      return true;
    });

    if (cleanedCount > 0) {
      await db.set("apiKeys", activeKeys);
      log.info(`Cleaned up ${cleanedCount} expired API keys`);
    }

    return cleanedCount;
  } catch (error) {
    log.error("Error cleaning up expired API keys:", error);
    return 0;
  }
}

/**
 * Get API key statistics
 * @param {string} userId - User ID (optional, for user-specific stats)
 * @returns {Object} API key statistics
 */
async function getApiKeyStats(userId = null) {
  try {
    const apiKeys = (await db.get("apiKeys")) || [];
    
    let filteredKeys = apiKeys;
    if (userId) {
      filteredKeys = apiKeys.filter(key => key.userId === userId);
    }

    const stats = {
      total: filteredKeys.length,
      active: filteredKeys.filter(key => key.isActive).length,
      expired: filteredKeys.filter(key => new Date() > new Date(key.expiresAt)).length,
      revoked: filteredKeys.filter(key => !key.isActive && key.revokedAt).length,
      totalUsage: filteredKeys.reduce((sum, key) => sum + (key.usageCount || 0), 0)
    };

    return stats;
  } catch (error) {
    log.error("Error getting API key stats:", error);
    return null;
  }
}

module.exports = {
  generateSecureApiKey,
  hashApiKey,
  createApiKey,
  validateApiKey,
  requireApiPermission,
  revokeApiKey,
  cleanupExpiredKeys,
  getApiKeyStats
};