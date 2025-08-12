const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../utils/authMiddleware.js");
const { 
  createApiKey, 
  revokeApiKey, 
  getApiKeyStats,
  cleanupExpiredKeys 
} = require("../../utils/apiKeySecurity.js");
const { db } = require("../../handlers/db.js");
const { logAudit } = require("../../handlers/auditLog.js");
const log = new (require("cat-loggr"))();

/**
 * GET /admin/api-keys
 * Display API key management page
 */
router.get("/admin/api-keys", requireAdmin, async (req, res) => {
  try {
    const apiKeys = (await db.get("apiKeys")) || [];
    const stats = await getApiKeyStats();
    
    // Filter out the actual key values for security
    const safeApiKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      userId: key.userId,
      permissions: key.permissions,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive,
      usageCount: key.usageCount || 0,
      revokedAt: key.revokedAt,
      revokedBy: key.revokedBy
    }));

    res.render("admin/api-keys", {
      req,
      apiKeys: safeApiKeys,
      stats,
      name: (await db.get("name")) || "Impulse"
    });
  } catch (error) {
    log.error("Error loading API keys page:", error);
    res.status(500).send("Error loading API keys");
  }
});

/**
 * POST /admin/api-keys/create
 * Create a new API key
 */
router.post("/admin/api-keys/create", requireAdmin, async (req, res) => {
  try {
    const { name, permissions, expiresInDays } = req.body;
    
    if (!name || !permissions) {
      return res.status(400).json({ error: "Name and permissions are required" });
    }

    const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
    const expiry = parseInt(expiresInDays) || 365;
    
    const newApiKey = await createApiKey(name, req.user.userId, permissionArray, expiry);
    
    logAudit(req.user.userId, req.user.username, "api_key:create", req.ip, {
      keyId: newApiKey.id,
      keyName: name,
      permissions: permissionArray
    });

    res.json({
      success: true,
      message: "API key created successfully",
      apiKey: newApiKey // This includes the plain key - show only once
    });
  } catch (error) {
    log.error("Error creating API key:", error);
    res.status(500).json({ error: "Failed to create API key" });
  }
});

/**
 * POST /admin/api-keys/revoke/:keyId
 * Revoke an API key
 */
router.post("/admin/api-keys/revoke/:keyId", requireAdmin, async (req, res) => {
  try {
    const { keyId } = req.params;
    
    const success = await revokeApiKey(keyId, req.user.userId);
    
    if (success) {
      logAudit(req.user.userId, req.user.username, "api_key:revoke", req.ip, {
        keyId: keyId
      });
      
      res.json({ success: true, message: "API key revoked successfully" });
    } else {
      res.status(404).json({ error: "API key not found or access denied" });
    }
  } catch (error) {
    log.error("Error revoking API key:", error);
    res.status(500).json({ error: "Failed to revoke API key" });
  }
});

/**
 * POST /admin/api-keys/cleanup
 * Clean up expired API keys
 */
router.post("/admin/api-keys/cleanup", requireAdmin, async (req, res) => {
  try {
    const cleanedCount = await cleanupExpiredKeys();
    
    logAudit(req.user.userId, req.user.username, "api_key:cleanup", req.ip, {
      cleanedCount: cleanedCount
    });
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${cleanedCount} expired API keys`,
      cleanedCount: cleanedCount
    });
  } catch (error) {
    log.error("Error cleaning up API keys:", error);
    res.status(500).json({ error: "Failed to clean up API keys" });
  }
});

/**
 * GET /admin/api-keys/stats
 * Get API key statistics
 */
router.get("/admin/api-keys/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await getApiKeyStats();
    res.json(stats);
  } catch (error) {
    log.error("Error getting API key stats:", error);
    res.status(500).json({ error: "Failed to get API key statistics" });
  }
});

module.exports = router;