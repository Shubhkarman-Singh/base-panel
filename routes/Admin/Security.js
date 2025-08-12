const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../utils/authMiddleware.js");
const { getSecurityEvents, cleanupSecurityLogs } = require("../../utils/securityLogger.js");
const { getApiKeyStats } = require("../../utils/apiKeySecurity.js");
const { db } = require("../../handlers/db.js");
const log = new (require("cat-loggr"))();

/**
 * GET /admin/security
 * Display security monitoring dashboard
 */
router.get("/admin/security", requireAdmin, async (req, res) => {
  try {
    // Get recent security events
    const recentEvents = await getSecurityEvents({ 
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours
    });

    // Get API key statistics
    const apiKeyStats = await getApiKeyStats();

    // Get critical events (last 7 days)
    const criticalEvents = await getSecurityEvents({
      severity: 'critical',
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Get high severity events (last 7 days)
    const highSeverityEvents = await getSecurityEvents({
      severity: 'high',
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Calculate security metrics
    const metrics = {
      totalEvents24h: recentEvents.length,
      criticalEvents7d: criticalEvents.length,
      highSeverityEvents7d: highSeverityEvents.length,
      apiKeyStats: apiKeyStats,
      topEventTypes: getTopEventTypes(recentEvents),
      topIPs: getTopIPs(recentEvents)
    };

    res.render("admin/security", {
      req,
      recentEvents: recentEvents.slice(0, 50), // Show last 50 events
      criticalEvents: criticalEvents.slice(0, 20),
      metrics,
      name: (await db.get("name")) || "Impulse"
    });
  } catch (error) {
    log.error("Error loading security dashboard:", error);
    res.status(500).send("Error loading security dashboard");
  }
});

/**
 * GET /admin/security/events
 * Get security events with filtering
 */
router.get("/admin/security/events", requireAdmin, async (req, res) => {
  try {
    const { eventType, severity, userId, since, limit = 100 } = req.query;
    
    const filters = {};
    if (eventType) filters.eventType = eventType;
    if (severity) filters.severity = severity;
    if (userId) filters.userId = userId;
    if (since) filters.since = since;

    const events = await getSecurityEvents(filters);
    
    res.json({
      success: true,
      events: events.slice(0, parseInt(limit)),
      total: events.length
    });
  } catch (error) {
    log.error("Error retrieving security events:", error);
    res.status(500).json({ error: "Failed to retrieve security events" });
  }
});

/**
 * POST /admin/security/cleanup-logs
 * Clean up old security logs
 */
router.post("/admin/security/cleanup-logs", requireAdmin, async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;
    const cleanedCount = await cleanupSecurityLogs(parseInt(daysToKeep));
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} old security log entries`,
      cleanedCount: cleanedCount
    });
  } catch (error) {
    log.error("Error cleaning up security logs:", error);
    res.status(500).json({ error: "Failed to clean up security logs" });
  }
});

/**
 * GET /admin/security/export
 * Export security events as JSON
 */
router.get("/admin/security/export", requireAdmin, async (req, res) => {
  try {
    const { since, eventType, severity } = req.query;
    
    const filters = {};
    if (since) filters.since = since;
    if (eventType) filters.eventType = eventType;
    if (severity) filters.severity = severity;

    const events = await getSecurityEvents(filters);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="security-events-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      filters: filters,
      totalEvents: events.length,
      events: events
    });
  } catch (error) {
    log.error("Error exporting security events:", error);
    res.status(500).json({ error: "Failed to export security events" });
  }
});

/**
 * Helper function to get top event types
 */
function getTopEventTypes(events) {
  const eventCounts = {};
  events.forEach(event => {
    eventCounts[event.eventType] = (eventCounts[event.eventType] || 0) + 1;
  });
  
  return Object.entries(eventCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([eventType, count]) => ({ eventType, count }));
}

/**
 * Helper function to get top IP addresses
 */
function getTopIPs(events) {
  const ipCounts = {};
  events.forEach(event => {
    if (event.ip) {
      ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
    }
  });
  
  return Object.entries(ipCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));
}

module.exports = router;