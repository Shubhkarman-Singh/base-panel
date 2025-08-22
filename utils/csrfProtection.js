const crypto = require('crypto');
const log = new (require("cat-loggr"))();
const { db } = require("../handlers/db.js");

/**
 * Enhanced CSRF Protection Middleware
 * Generates and validates CSRF tokens for form submissions with database persistence
 */
class CSRFProtection {
  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create CSRF token for a session
   */
  async createToken(sessionId) {
    const token = this.generateToken();
    const timestamp = Date.now();

    // Store token in database with timestamp for persistence
    const tokenData = {
      timestamp,
      used: false,
      sessionId
    };

    try {
      const csrfTokens = (await db.get("csrf_tokens")) || {};
      csrfTokens[token] = tokenData;
      await db.set("csrf_tokens", csrfTokens);
    } catch (error) {
      log.error("Failed to store CSRF token:", error);
      throw new Error("Failed to create CSRF token");
    }

    return token;
  }

  /**
   * Validate CSRF token
   */
  async validateToken(sessionId, token) {
    if (!sessionId || !token) {
      return false;
    }

    try {
      const csrfTokens = (await db.get("csrf_tokens")) || {};
      const tokenData = csrfTokens[token];

    if (!tokenData) {
      return false;
    }

      // Verify token belongs to this session
      if (tokenData.sessionId !== sessionId) {
        return false;
      }

      // Check if token is expired (1 hour for security)
      const maxAge = 60 * 60 * 1000; // 1 hour
    if (Date.now() - tokenData.timestamp > maxAge) {
        delete csrfTokens[token];
        await db.set("csrf_tokens", csrfTokens);
      return false;
    }

      // One-time use only - no reuse allowed
      if (tokenData.used) {
      return false;
    }

      // Mark token as used
    tokenData.used = true;
      tokenData.usedAt = Date.now();
      csrfTokens[token] = tokenData;
      await db.set("csrf_tokens", csrfTokens);

    return true;
    } catch (error) {
      log.error("CSRF token validation error:", error);
      return false;
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleaned = 0;

    try {
      const csrfTokens = (await db.get("csrf_tokens")) || {};
      const validTokens = {};

      for (const [token, data] of Object.entries(csrfTokens)) {
        // Keep only non-expired tokens
        if (now - data.timestamp <= maxAge) {
          validTokens[token] = data;
        } else {
        cleaned++;
      }
      }

      if (cleaned > 0) {
        await db.set("csrf_tokens", validTokens);
      }
    } catch (error) {
      log.error("CSRF cleanup error:", error);
    }

    if (cleaned > 0) {
      log.info(`CSRF cleanup: removed ${cleaned} expired/used tokens`);
    }
  }

  /**
   * Middleware to add CSRF token to response locals
   */
  addTokenToLocals() {
    return async (req, res, next) => {
      if (req.session) {
        // Ensure session has an ID
        if (!req.session.id) {
          req.session.regenerate(async (err) => {
            if (err) {
              log.error('Session regeneration error:', err);
              return next();
            }
            try {
              const token = await this.createToken(req.session.id);
            res.locals.csrfToken = token;
            next();
            } catch (error) {
              log.error('CSRF token creation error:', error);
              next();
            }
          });
        } else {
          // Always generate a fresh token for each request
          try {
            const token = await this.createToken(req.session.id);
          res.locals.csrfToken = token;
          next();
          } catch (error) {
            log.error('CSRF token creation error:', error);
            next();
          }
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
    return async (req, res, next) => {
      // Skip validation for GET, HEAD, OPTIONS requests
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip validation for API endpoints (they should use API keys)
      if (req.path.startsWith('/api/')) {
        return next();
      }

      const sessionId = req.session?.id;
      const token = req.body._csrf || req.headers['x-csrf-token'];

      if (!sessionId) {
        log.warn(`No session ID for CSRF validation on ${req.method} ${req.path}`);
        
        // Require session for all POST requests
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({
            error: 'Session required',
            code: 'SESSION_REQUIRED'
          });
        }
        return res.redirect('/auth/login?err=SessionRequired');
      }

      if (!token) {
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

      const isValid = await this.validateToken(sessionId, token);
      if (!isValid) {
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
  async getTokenCount() {
    try {
      const csrfTokens = (await db.get("csrf_tokens")) || {};
      return Object.keys(csrfTokens).length;
    } catch (error) {
      log.error("Error getting CSRF token count:", error);
      return 0;
    }
  }

  /**
   * Clear all tokens (for testing or security incidents)
   */
  async clearAllTokens() {
    try {
      const csrfTokens = (await db.get("csrf_tokens")) || {};
      const count = Object.keys(csrfTokens).length;
      await db.set("csrf_tokens", {});
    log.warn(`Cleared all ${count} CSRF tokens`);
    return count;
    } catch (error) {
      log.error("Error clearing CSRF tokens:", error);
      return 0;
    }
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
  generateCSRFToken: async (sessionId) => await csrfProtection.createToken(sessionId),
  clearAllTokens: async () => await csrfProtection.clearAllTokens()
};