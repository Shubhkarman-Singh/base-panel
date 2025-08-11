const rateLimit = require("express-rate-limit");
const { db } = require("../handlers/db.js");
const log = new (require("cat-loggr"))();

/**
 * Advanced rate limiting with exponential backoff and persistent storage
 */
class AdvancedRateLimit {
  constructor() {
    this.attempts = new Map(); // In-memory cache for quick access
    this.loadAttempts();
  }

  async loadAttempts() {
    try {
      const storedAttempts = await db.get("rate_limit_attempts");
      if (storedAttempts) {
        this.attempts = new Map(Object.entries(storedAttempts));
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
   * Get exponential backoff delay based on attempt count
   */
  getBackoffDelay(attempts) {
    // Exponential backoff: 1min, 5min, 15min, 1hour, 6hours, 24hours
    const delays = [
      1 * 60 * 1000,      // 1 minute
      5 * 60 * 1000,      // 5 minutes
      15 * 60 * 1000,     // 15 minutes
      60 * 60 * 1000,     // 1 hour
      6 * 60 * 60 * 1000, // 6 hours
      24 * 60 * 60 * 1000 // 24 hours
    ];
    
    const index = Math.min(attempts - 1, delays.length - 1);
    return delays[index];
  }

  /**
   * Create rate limiter with exponential backoff for failed login attempts
   */
  createLoginLimiter() {
    return async (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const key = `login_${ip}`;
      const now = Date.now();

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

      // Reset if enough time has passed (24 hours)
      if (now - attemptData.lastAttempt > 24 * 60 * 60 * 1000) {
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
            
            log.warn(`IP ${ip} blocked for ${delay/1000/60} minutes after ${attemptData.count} failed login attempts`);
          }
          
          this.attempts.set(key, attemptData);
          this.saveAttempts();
        } else if (res.statusCode === 200 || (res.statusCode === 302 && 
          !(res.getHeader('location') || '').includes('err='))) {
          // Successful login - reset attempts
          this.attempts.delete(key);
          this.saveAttempts();
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
        return `${req.ip}_${email}`;
      },
      message: {
        error: "Too many password reset attempts for this email/IP combination",
        retryAfter: "1 hour"
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  /**
   * Clean up old entries (run periodically)
   */
  cleanup() {
    const now = Date.now();
    const cutoff = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [key, data] of this.attempts.entries()) {
      if (now - data.lastAttempt > cutoff) {
        this.attempts.delete(key);
      }
    }
    
    this.saveAttempts();
    log.info(`Rate limit cleanup completed. Active entries: ${this.attempts.size}`);
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
  createPasswordResetLimiter: () => advancedRateLimit.createPasswordResetLimiter()
};