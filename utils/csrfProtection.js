const crypto = require('crypto');
const log = new (require("cat-loggr"))();

/**
 * Custom CSRF Protection Middleware
 * Generates and validates CSRF tokens for form submissions
 */
class CSRFProtection {
  constructor() {
    this.tokenStore = new Map(); // In-memory token store
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create CSRF token for a session
   */
  createToken(sessionId) {
    const token = this.generateToken();
    const timestamp = Date.now();

    // Store token with timestamp for expiration
    this.tokenStore.set(`${sessionId}_${token}`, {
      timestamp,
      used: false
    });

    return token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(sessionId, token) {
    if (!sessionId || !token) {
      return false;
    }

    const key = `${sessionId}_${token}`;
    const tokenData = this.tokenStore.get(key);

    if (!tokenData) {
      return false;
    }

    // Check if token is expired (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - tokenData.timestamp > maxAge) {
      this.tokenStore.delete(key);
      return false;
    }

    // Allow token reuse within a short time window (5 minutes) to handle multiple form submissions
    const reuseWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    if (tokenData.used && (now - tokenData.lastUsed) < reuseWindow) {
      // Token was recently used, allow reuse within the window
      tokenData.lastUsed = now;
      this.tokenStore.set(key, tokenData);
      return true;
    } else if (tokenData.used && (now - tokenData.lastUsed) >= reuseWindow) {
      // Token is too old for reuse
      return false;
    }

    // Mark token as used for the first time
    tokenData.used = true;
    tokenData.lastUsed = now;
    this.tokenStore.set(key, tokenData);

    return true;
  }

  /**
   * Clean up expired tokens
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [key, data] of this.tokenStore.entries()) {
      // Clean up tokens that are expired or haven't been used in a long time
      const isExpired = now - data.timestamp > maxAge;
      const isStale = data.used && data.lastUsed && (now - data.lastUsed) > maxAge;
      
      if (isExpired || isStale) {
        this.tokenStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`CSRF cleanup: removed ${cleaned} expired/used tokens`);
    }
  }

  /**
   * Middleware to add CSRF token to response locals
   */
  addTokenToLocals() {
    return (req, res, next) => {
      if (req.session) {
        // Ensure session has an ID
        if (!req.session.id) {
          req.session.regenerate((err) => {
            if (err) {
              log.error('Session regeneration error:', err);
              return next();
            }
            const token = this.createToken(req.session.id);
            res.locals.csrfToken = token;
            next();
          });
        } else {
          // Always generate a fresh token for each request to avoid one-time use issues
          const token = this.createToken(req.session.id);
          res.locals.csrfToken = token;
          next();
        }
      } else {
        // No session, skip CSRF for this request
        res.locals.csrfToken = '';
        next();
      }
    };
  }

  /**
   * Middleware to validate CSRF token on POST requests
   */
  validateTokenMiddleware() {
    return (req, res, next) => {
      // Skip validation for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip validation for API endpoints (they should use API keys)
      if (req.path.startsWith('/api/')) {
        return next();
      }

      // Get configuration
      const config = require("../config.json");
      const isDevelopment = config.mode === 'development';

      const sessionId = req.session?.id;
      const token = req.body._csrf || req.headers['x-csrf-token'];

      // Debug logging in development
      if (isDevelopment) {
        log.debug(`CSRF validation: sessionId=${sessionId}, token=${token ? 'present' : 'missing'}, path=${req.path}`);
      }

      if (!sessionId) {
        if (isDevelopment) {
          log.debug(`No session ID for CSRF validation on ${req.method} ${req.path} - allowing in development`);
          return next();
        }
        log.warn(`No session ID for CSRF validation on ${req.method} ${req.path}`);
        
        // In production, require session for all POST requests
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({
            error: 'Session required',
            code: 'SESSION_REQUIRED'
          });
        }
        return res.redirect('/auth/login?err=SessionRequired');
      }

      if (!token) {
        if (isDevelopment) {
          log.debug(`Missing CSRF token for ${req.method} ${req.path} - allowing in development`);
          return next();
        }

        log.warn(`Missing CSRF token for ${req.method} ${req.path} from IP ${req.ip}`);

        // For AJAX requests, return JSON error
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({
            error: 'CSRF token missing',
            code: 'CSRF_MISSING'
          });
        }

        // For form submissions, redirect with error
        const referer = req.get('Referer') || '/';
        const separator = referer.includes('?') ? '&' : '?';
        return res.redirect(`${referer}${separator}err=CSRFTokenMissing`);
      }

      if (!this.validateToken(sessionId, token)) {
        log.warn(`CSRF validation failed for ${req.method} ${req.path} from IP ${req.ip}`);

        // For AJAX requests, return JSON error
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({
            error: 'CSRF token validation failed',
            code: 'CSRF_INVALID'
          });
        }

        // For form submissions, redirect with error
        const referer = req.get('Referer') || '/';
        const separator = referer.includes('?') ? '&' : '?';
        return res.redirect(`${referer}${separator}err=CSRFValidationFailed`);
      }

      next();
    };
  }

  /**
   * Get token count for monitoring
   */
  getTokenCount() {
    return this.tokenStore.size;
  }

  /**
   * Clear all tokens (for testing or security incidents)
   */
  clearAllTokens() {
    const count = this.tokenStore.size;
    this.tokenStore.clear();
    log.warn(`Cleared all ${count} CSRF tokens`);
    return count;
  }
}

// Create singleton instance
const csrfProtection = new CSRFProtection();

// Graceful shutdown cleanup
process.on('SIGTERM', () => {
  if (csrfProtection.cleanupInterval) {
    clearInterval(csrfProtection.cleanupInterval);
  }
});

process.on('SIGINT', () => {
  if (csrfProtection.cleanupInterval) {
    clearInterval(csrfProtection.cleanupInterval);
  }
});

module.exports = {
  csrfProtection,
  addCSRFToken: () => csrfProtection.addTokenToLocals(),
  validateCSRF: () => csrfProtection.validateTokenMiddleware(),
  generateCSRFToken: (sessionId) => csrfProtection.createToken(sessionId),
  clearAllTokens: () => csrfProtection.clearAllTokens()
};