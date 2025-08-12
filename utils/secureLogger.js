/**
 * @fileoverview Secure logging utility that filters sensitive data from logs
 * Prevents passwords, tokens, and other sensitive information from being logged
 */

const log = new (require("cat-loggr"))();

class SecureLogger {
  constructor() {
    // Sensitive field patterns to filter from logs
    this.sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /session/i,
      /cookie/i,
      /credential/i,
      /private/i,
      /confidential/i
    ];

    // Specific sensitive field names
    this.sensitiveFields = [
      'password',
      'newPassword',
      'currentPassword',
      'confirmPassword',
      'token',
      'accessToken',
      'refreshToken',
      'resetToken',
      'sessionToken',
      'apiKey',
      'secret',
      'sessionSecret',
      'twoFASecret',
      'privateKey',
      'authorization',
      'cookie',
      'session',
      'csrf',
      '_csrf'
    ];
  }

  /**
   * Sanitize an object by removing or masking sensitive fields
   * @param {any} obj - Object to sanitize
   * @param {number} depth - Current recursion depth (prevents infinite loops)
   * @returns {any} Sanitized object
   */
  sanitizeObject(obj, depth = 0) {
    // Prevent infinite recursion
    if (depth > 10) return '[Max Depth Reached]';
    
    if (obj === null || obj === undefined) return obj;
    
    // Handle primitive types
    if (typeof obj !== 'object') return obj;
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }
    
    // Handle objects
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Check if field name is sensitive
      const isSensitiveField = this.sensitiveFields.includes(key.toLowerCase()) ||
                              this.sensitivePatterns.some(pattern => pattern.test(key));
      
      if (isSensitiveField) {
        // Mask sensitive data
        if (typeof value === 'string' && value.length > 0) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize log message and data
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   * @returns {object} Sanitized message and data
   */
  sanitizeLogData(message, data) {
    // Sanitize message for sensitive patterns
    let sanitizedMessage = message;
    this.sensitivePatterns.forEach(pattern => {
      sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
    });

    // Sanitize data object
    const sanitizedData = data ? this.sanitizeObject(data) : undefined;

    return { message: sanitizedMessage, data: sanitizedData };
  }

  /**
   * Secure info logging
   */
  info(message, data) {
    const { message: safeMessage, data: safeData } = this.sanitizeLogData(message, data);
    if (safeData) {
      log.info(safeMessage, safeData);
    } else {
      log.info(safeMessage);
    }
  }

  /**
   * Secure error logging
   */
  error(message, data) {
    const { message: safeMessage, data: safeData } = this.sanitizeLogData(message, data);
    if (safeData) {
      log.error(safeMessage, safeData);
    } else {
      log.error(safeMessage);
    }
  }

  /**
   * Secure warning logging
   */
  warn(message, data) {
    const { message: safeMessage, data: safeData } = this.sanitizeLogData(message, data);
    if (safeData) {
      log.warn(safeMessage, safeData);
    } else {
      log.warn(safeMessage);
    }
  }

  /**
   * Secure debug logging
   */
  debug(message, data) {
    const { message: safeMessage, data: safeData } = this.sanitizeLogData(message, data);
    if (safeData) {
      log.debug(safeMessage, safeData);
    } else {
      log.debug(safeMessage);
    }
  }

  /**
   * Log authentication attempts (with IP masking for privacy)
   */
  logAuthAttempt(username, success, ip, userAgent) {
    const maskedIP = this.maskIP(ip);
    const sanitizedUserAgent = userAgent ? userAgent.substring(0, 100) : 'Unknown';
    
    this.info(`Authentication attempt: ${success ? 'SUCCESS' : 'FAILED'}`, {
      username,
      success,
      ip: maskedIP,
      userAgent: sanitizedUserAgent,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(event, details) {
    this.warn(`Security Event: ${event}`, this.sanitizeObject(details));
  }

  /**
   * Mask IP address for privacy (keep first 3 octets for IPv4, first 4 groups for IPv6)
   */
  maskIP(ip) {
    if (!ip) return 'Unknown';
    
    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    
    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::xxxx`;
      }
    }
    
    return 'xxx.xxx.xxx.xxx';
  }
}

// Export singleton instance
module.exports = new SecureLogger();