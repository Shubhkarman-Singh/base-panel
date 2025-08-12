/**
 * Enhanced Authentication Middleware
 * Provides comprehensive authentication checks and route protection
 */

const { db } = require("../handlers/db.js");
const log = new (require("cat-loggr"))();
const { logSecurityEvent, SECURITY_EVENTS } = require("./securityLogger.js");

/**
 * Enhanced authentication middleware with session validation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
function requireAuth(req, res, next) {
  // Check if user is authenticated
  if (!req.user) {
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ error: "Authentication required" });
    }
    return res.redirect("/auth");
  }

  // Validate user object structure
  if (typeof req.user !== 'object' || !req.user.userId) {
    req.session.destroy();
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({ error: "Invalid session" });
    }
    return res.redirect("/auth");
  }

  // Verify user still exists in database
  db.get("users").then(users => {
    const currentUser = users?.find(u => u.userId === req.user.userId);
    
    if (!currentUser) {
      logSecurityEvent(SECURITY_EVENTS.SESSION_HIJACK_ATTEMPT, req.user.userId, req.ip, {
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID
      }, 'high');
      
      req.session.destroy();
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({ error: "User account not found" });
      }
      return res.redirect("/auth");
    }
    
    // Update req.user with fresh data from database
    req.user = currentUser;
    next();
  }).catch(error => {
    log.error("Authentication verification error:", error);
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(500).json({ error: "Authentication verification failed" });
    }
    return res.redirect("/auth");
  });
}

/**
 * Instance access authorization middleware
 * Verifies user has access to specific instance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireInstanceAccess(req, res, next) {
  const instanceId = req.params.id;
  
  if (!instanceId) {
    return res.status(400).json({ error: "Instance ID required" });
  }

  // Admin users have access to all instances
  if (req.user.admin === true) {
    return next();
  }

  // Check if user has access to this specific instance
  db.get(`${req.user.userId}_instances`).then(userInstances => {
    const hasAccess = userInstances?.some(instance => 
      instance.Id === instanceId || instance.ContainerId === instanceId
    );
    
    if (!hasAccess) {
      logSecurityEvent(SECURITY_EVENTS.PERMISSION_DENIED, req.user.userId, req.ip, {
        resource: 'instance',
        instanceId: instanceId,
        userAgent: req.get('User-Agent')
      }, 'medium');
      
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ error: "Access denied to this instance" });
      }
      return res.redirect("/instances");
    }
    
    next();
  }).catch(error => {
    log.error("Instance access verification error:", error);
    return res.status(500).json({ error: "Access verification failed" });
  });
}

/**
 * Admin-only middleware with enhanced security
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAdmin(req, res, next) {
  // First ensure user is authenticated
  requireAuth(req, res, () => {
    // Then check admin privileges
    if (req.user.admin !== true || typeof req.user.admin !== 'boolean') {
      logSecurityEvent(SECURITY_EVENTS.ADMIN_DENIED, req.user.userId, req.ip, {
        userAgent: req.get('User-Agent'),
        route: req.originalUrl
      }, 'high');
      
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(403).json({ error: "Administrator privileges required" });
      }
      return res.redirect("/instances");
    }
    
    // Log successful admin access
    logSecurityEvent(SECURITY_EVENTS.ADMIN_ACCESS, req.user.userId, req.ip, {
      userAgent: req.get('User-Agent'),
      route: req.originalUrl
    }, 'medium');
    
    next();
  });
}

/**
 * Rate limiting aware authentication
 * Tracks failed authentication attempts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function trackAuthAttempt(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Log authentication attempt for monitoring
  log.info(`Auth attempt from IP: ${clientIP}, User-Agent: ${req.get('User-Agent')}`);
  
  next();
}

module.exports = {
  requireAuth,
  requireInstanceAccess,
  requireAdmin,
  trackAuthAttempt
};