/**
 * Security Event Logger
 * Centralized logging for security-related events
 */

const { db } = require("../handlers/db.js");
const log = new (require("cat-loggr"))();

/**
 * Log security events to database and console
 * @param {string} eventType - Type of security event
 * @param {string} userId - User ID involved (if applicable)
 * @param {string} ip - IP address
 * @param {Object} details - Additional event details
 * @param {string} severity - Event severity (low, medium, high, critical)
 */
async function logSecurityEvent(eventType, userId = null, ip = null, details = {}, severity = 'medium') {
  const timestamp = new Date().toISOString();
  
  const securityEvent = {
    id: require('crypto').randomUUID(),
    timestamp,
    eventType,
    userId,
    ip,
    details,
    severity,
    userAgent: details.userAgent || null
  };

  try {
    // Store in database
    const securityLogs = (await db.get("security_logs")) || [];
    securityLogs.push(securityEvent);
    
    // Keep only last 10000 events to prevent database bloat
    if (securityLogs.length > 10000) {
      securityLogs.splice(0, securityLogs.length - 10000);
    }
    
    await db.set("security_logs", securityLogs);

    // Log to console based on severity
    const logMessage = `Security Event [${severity.toUpperCase()}]: ${eventType} - User: ${userId || 'N/A'} - IP: ${ip || 'N/A'}`;
    
    switch (severity) {
      case 'critical':
        log.error(logMessage, details);
        break;
      case 'high':
        log.warn(logMessage, details);
        break;
      case 'medium':
        log.info(logMessage, details);
        break;
      case 'low':
        log.debug(logMessage, details);
        break;
      default:
        log.info(logMessage, details);
    }

  } catch (error) {
    log.error("Failed to log security event:", error);
  }
}

/**
 * Get security events for monitoring
 * @param {Object} filters - Filter options
 * @returns {Array} Security events
 */
async function getSecurityEvents(filters = {}) {
  try {
    const securityLogs = (await db.get("security_logs")) || [];
    
    let filteredLogs = securityLogs;
    
    if (filters.eventType) {
      filteredLogs = filteredLogs.filter(event => event.eventType === filters.eventType);
    }
    
    if (filters.userId) {
      filteredLogs = filteredLogs.filter(event => event.userId === filters.userId);
    }
    
    if (filters.severity) {
      filteredLogs = filteredLogs.filter(event => event.severity === filters.severity);
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      filteredLogs = filteredLogs.filter(event => new Date(event.timestamp) >= sinceDate);
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return filteredLogs;
  } catch (error) {
    log.error("Error retrieving security events:", error);
    return [];
  }
}

/**
 * Clean up old security logs
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {number} Number of logs cleaned up
 */
async function cleanupSecurityLogs(daysToKeep = 90) {
  try {
    const securityLogs = (await db.get("security_logs")) || [];
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    const filteredLogs = securityLogs.filter(event => 
      new Date(event.timestamp) >= cutoffDate
    );
    
    const cleanedCount = securityLogs.length - filteredLogs.length;
    
    if (cleanedCount > 0) {
      await db.set("security_logs", filteredLogs);
      log.info(`Cleaned up ${cleanedCount} old security log entries`);
    }
    
    return cleanedCount;
  } catch (error) {
    log.error("Error cleaning up security logs:", error);
    return 0;
  }
}

// Security event types
const SECURITY_EVENTS = {
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',
  ADMIN_ACCESS: 'admin_access',
  ADMIN_DENIED: 'admin_access_denied',
  API_KEY_CREATED: 'api_key_created',
  API_KEY_REVOKED: 'api_key_revoked',
  API_KEY_INVALID: 'api_key_invalid',
  API_KEY_EXPIRED: 'api_key_expired',
  PERMISSION_DENIED: 'permission_denied',
  SESSION_HIJACK_ATTEMPT: 'session_hijack_attempt',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
};

module.exports = {
  logSecurityEvent,
  getSecurityEvents,
  cleanupSecurityLogs,
  SECURITY_EVENTS
};