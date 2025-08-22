const rateLimit = require("express-rate-limit");
const { db } = require("../handlers/db.js");
const log = new (require("cat-loggr"))();

/**
 * Advanced rate limiting with exponential backoff and persistent storage
 */
class AdvancedRateLimit {
  constructor() {
    this.attempts = new Map(); // In-memory cache for quick access
    this.blockedIPs = new Set(); // Quick lookup for blocked IPs
    this.loadAttempts();
  }

  async loadAttempts() {
    try {
      const storedAttempts = await db.get("rate_limit_attempts");
      if (storedAttempts) {
        this.attempts = new Map(Object.entries(storedAttempts));
        // Rebuild blocked IPs set
        this.blockedIPs.clear();
        for (const [key, data] of this.attempts.entries()) {
          if (data.blockedUntil > Date.now()) {
            this.blockedIPs.add(key);
          }
        }
      }
    } catch (error) {
      log.error("Error loading rate limit attempts:", error);
    }
  }

  async saveAttempts() {
    try {
      const attemptsObj = Object.fromEntries(this.attempts);
      await db.set("rate_limit_attempts", attemptsObj);
    } catch (error) {
      log.error("Error saving rate limit attempts:", error);
    }
  }

  /**
   * Get client IP address with proxy support
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           req.ip || 
           'unknown';
  }

  /**
   * Get exponential backoff delay based on attempt count
   */
  getBackoffDelay(attempts) {
    // Exponential backoff: 5min, 15min, 1hour, 6hours, 24hours, 7days
    const delays = [
      5 * 60 * 1000,       // 5 minutes
      15 * 60 * 1000,      // 15 minutes
      60 * 60 * 1000,      // 1 hour
      6 * 60 * 60 * 1000,  // 6 hours
      24 * 60 * 60 * 1000, // 24 hours
      7 * 24 * 60 * 60 * 1000 // 7 days
    ];
    
    const index = Math.min(attempts - 1, delays.length - 1);
    return delays[index];
  }

  /**
   * Create rate limiter with exponential backoff for failed login attempts
   */
  createLoginLimiter() {
    return async (req, res, next) => {
      const ip = this.getClientIP(req);
      const key = `login_${ip}`;
      const now = Date.now();

      // Quick check for blocked IPs
      if (this.blockedIPs.has(key)) {
        const attemptData = this.attempts.get(key);
        if (attemptData && attemptData.blockedUntil > now) {
          const remainingTime = Math.ceil((attemptData.blockedUntil - now) / 1000 / 60);
          return res.status(429).json({
            error: "Too many failed login attempts",
            retryAfter: `${remainingTime} minutes`,
            blockedUntil: new Date(attemptData.blockedUntil).toISOString()
          });
        } else {
          // Block expired, remove from blocked set
          this.blockedIPs.delete(key);
        }
      }

      // Get current attempt data
      let attemptData = this.attempts.get(key);
      if (!attemptData) {
        attemptData = { count: 0, lastAttempt: now, blockedUntil: 0 };
      }

      // Check if still blocked
      if (attemptData.blockedUntil > now) {
        const remainingTime = Math.ceil((attemptData.blockedUntil - now) / 1000 / 60);
        return res.status(429).json({
          error: "Too many failed login attempts",
          retryAfter: `${remainingTime} minutes`,
          blockedUntil: new Date(attemptData.blockedUntil).toISOString()
        });
      }

      // Reset if enough time has passed (7 days)
      if (now - attemptData.lastAttempt > 7 * 24 * 60 * 60 * 1000) {
        attemptData = { count: 0, lastAttempt: now, blockedUntil: 0 };
      }

      // Store original end method to intercept response
      const originalEnd = res.end;
      res.end = (chunk, encoding) => {
        // Check if login failed (status 302 with error redirect or 401/403)
        const loginFailed = (res.statusCode === 302 && 
          (res.getHeader('location') || '').includes('err=')) ||
          res.statusCode === 401 || res.statusCode === 403;

        if (loginFailed) {
          attemptData.count++;
          attemptData.lastAttempt = now;
          
          if (attemptData.count >= 3) {
            const delay = this.getBackoffDelay(attemptData.count - 2);
            attemptData.blockedUntil = now + delay;
            this.blockedIPs.add(key);
            
            log.warn(`IP ${ip} blocked for ${delay/1000/60} minutes after ${attemptData.count} failed login attempts`);
            
            // Log security event
            log.security(`Failed login attempts exceeded for IP ${ip}`, {
              ip,
              attempts: attemptData.count,
              blockedUntil: new Date(attemptData.blockedUntil).toISOString(),
              userAgent: req.headers['user-agent'],
              timestamp: new Date().toISOString()
            });
          }
          
          this.attempts.set(key, attemptData);
          this.saveAttempts();
        } else if (res.statusCode === 200 || (res.statusCode === 302 && 
          !(res.getHeader('location') || '').includes('err='))) {
          // Successful login - reset attempts
          this.attempts.delete(key);
          this.blockedIPs.delete(key);
          this.saveAttempts();
          
          log.info(`Successful login for IP ${ip}, resetting rate limit attempts`);
        }

        originalEnd.call(res, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Create rate limiter for password reset attempts
   */
  createPasswordResetLimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 attempts per hour
      keyGenerator: (req) => {
        // Rate limit by IP and email combination
        const email = req.body.email || 'unknown';
        const ip = this.getClientIP(req);
        return `reset_${ip}_${email}`;
      },
      message: {
        error: "Too many password reset attempts for this email/IP combination",
        retryAfter: "1 hour"
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false, // Count all attempts
    });
  }

  /**
   * Create rate limiter for registration attempts
   */
  createRegistrationLimiter() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 registration attempts per hour
      keyGenerator: (req) => {
        const ip = this.getClientIP(req);
        return `register_${ip}`;
      },
      message: {
        error: "Too many registration attempts from this IP",
        retryAfter: "1 hour"
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
    });
  }

  /**
   * Clean up old entries (run periodically)
   */
  cleanup() {
    const now = Date.now();
    const cutoff = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    let cleanedCount = 0;
    for (const [key, data] of this.attempts.entries()) {
      if (now - data.lastAttempt > cutoff) {
        this.attempts.delete(key);
        this.blockedIPs.delete(key);
        cleanedCount++;
      }
    }
    
    this.saveAttempts();
    log.info(`Rate limit cleanup completed. Cleaned ${cleanedCount} entries. Active entries: ${this.attempts.size}`);
  }

  /**
   * Get rate limit statistics
   */
  getStats() {
    const now = Date.now();
    const stats = {
      totalEntries: this.attempts.size,
      blockedEntries: 0,
      activeBlocks: 0
    };

    for (const [key, data] of this.attempts.entries()) {
      if (data.blockedUntil > 0) {
        stats.blockedEntries++;
        if (data.blockedUntil > now) {
          stats.activeBlocks++;
        }
      }
    }

    return stats;
  }
}

// Create singleton instance
const advancedRateLimit = new AdvancedRateLimit();

// Clean up old entries every 6 hours
setInterval(() => {
  advancedRateLimit.cleanup();
}, 6 * 60 * 60 * 1000);

module.exports = {
  advancedRateLimit,
  createLoginLimiter: () => advancedRateLimit.createLoginLimiter(),
  createPasswordResetLimiter: () => advancedRateLimit.createPasswordResetLimiter(),
  createRegistrationLimiter: () => advancedRateLimit.createRegistrationLimiter()
};