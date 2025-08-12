/**
 * @fileoverview Data sanitization utility to prevent sensitive data exposure
 * Provides methods to safely sanitize user data before sending to clients
 */

class DataSanitizer {
  constructor() {
    // Define sensitive fields that should never be exposed
    this.sensitiveFields = [
      'password',
      'twoFASecret',
      'resetToken',
      'resetTokenExpiry',
      'sessionId',
      'session',
      'cookie',
      'secret',
      'privateKey',
      'apiKey',
      'token',
      'auth',
      'credential'
    ];

    // Define fields that should be masked rather than removed
    this.maskableFields = [
      'email'
    ];
  }

  /**
   * Sanitize user object for public API responses
   * @param {Object} user - User object from database
   * @param {Object} options - Sanitization options
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user, options = {}) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    const {
      includeEmail = false,
      includeAdminStatus = true,
      includePersonalData = true
    } = options;

    const sanitized = {
      userId: user.userId,
      username: user.username
    };

    // Include admin status if requested
    if (includeAdminStatus) {
      sanitized.admin = user.admin || false;
    }

    // Include personal data if requested
    if (includePersonalData) {
      sanitized.twoFAEnabled = user.twoFAEnabled || false;
      sanitized.createdAt = user.createdAt;
      sanitized.lastLogin = user.lastLogin;

      // Avatar data
      if (user.customAvatarUrl && typeof user.customAvatarUrl === 'string') {
        sanitized.customAvatarUrl = user.customAvatarUrl;
      }
      if (user.boringAvatarStyle && typeof user.boringAvatarStyle === 'string') {
        sanitized.boringAvatarStyle = user.boringAvatarStyle;
      }
      if (user.boringAvatarColors && Array.isArray(user.boringAvatarColors)) {
        sanitized.boringAvatarColors = user.boringAvatarColors;
      }
    }

    // Include email if specifically requested and user has permission
    if (includeEmail && user.email) {
      sanitized.email = this.maskEmail(user.email);
    }

    return sanitized;
  }

  /**
   * Sanitize array of users
   * @param {Array} users - Array of user objects
   * @param {Object} options - Sanitization options
   * @returns {Array} Array of sanitized user objects
   */
  sanitizeUsers(users, options = {}) {
    if (!Array.isArray(users)) {
      return [];
    }

    return users
      .map(user => this.sanitizeUser(user, options))
      .filter(user => user !== null);
  }

  /**
   * Mask email address for privacy
   * @param {string} email - Email address to mask
   * @returns {string} Masked email address
   */
  maskEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }

    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return '[INVALID EMAIL]';
    }

    // Mask local part: show first 2 and last 1 characters
    let maskedLocal;
    if (localPart.length <= 3) {
      maskedLocal = localPart.charAt(0) + '*'.repeat(localPart.length - 1);
    } else {
      maskedLocal = localPart.substring(0, 2) + '*'.repeat(localPart.length - 3) + localPart.slice(-1);
    }

    return `${maskedLocal}@${domain}`;
  }

  /**
   * Remove sensitive fields from any object
   * @param {any} obj - Object to sanitize
   * @param {number} depth - Current recursion depth
   * @returns {any} Sanitized object
   */
  removeSensitiveFields(obj, depth = 0) {
    // Prevent infinite recursion
    if (depth > 10) return '[Max Depth Reached]';
    
    if (obj === null || obj === undefined) return obj;
    
    // Handle primitive types
    if (typeof obj !== 'object') return obj;
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeSensitiveFields(item, depth + 1));
    }
    
    // Handle objects
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      
      // Check if field is sensitive
      const isSensitive = this.sensitiveFields.some(field => 
        keyLower.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        // Skip sensitive fields entirely
        continue;
      }
      
      // Check if field should be masked
      const shouldMask = this.maskableFields.some(field => 
        keyLower.includes(field.toLowerCase())
      );
      
      if (shouldMask && typeof value === 'string') {
        if (keyLower.includes('email')) {
          sanitized[key] = this.maskEmail(value);
        } else {
          sanitized[key] = this.maskString(value);
        }
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = this.removeSensitiveFields(value, depth + 1);
      }
    }
    
    return sanitized;
  }

  /**
   * Mask a string value
   * @param {string} str - String to mask
   * @returns {string} Masked string
   */
  maskString(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }

    if (str.length <= 4) {
      return '*'.repeat(str.length);
    }

    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.slice(-2);
  }

  /**
   * Sanitize request body for logging
   * @param {Object} body - Request body
   * @returns {Object} Sanitized body
   */
  sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') {
      return body;
    }

    return this.removeSensitiveFields(body);
  }

  /**
   * Sanitize error object for safe logging
   * @param {Error} error - Error object
   * @returns {Object} Sanitized error data
   */
  sanitizeError(error) {
    if (!error) return null;

    const sanitized = {
      message: error.message,
      name: error.name,
      stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : undefined
    };

    // Remove any sensitive data from error message
    if (sanitized.message) {
      this.sensitiveFields.forEach(field => {
        const regex = new RegExp(field, 'gi');
        sanitized.message = sanitized.message.replace(regex, '[REDACTED]');
      });
    }

    return sanitized;
  }

  /**
   * Create safe user profile for current user
   * @param {Object} user - Current user object
   * @returns {Object} Safe user profile
   */
  createUserProfile(user) {
    if (!user) return null;

    return {
      userId: user.userId,
      username: user.username,
      email: user.email, // Full email for own profile
      admin: user.admin || false,
      twoFAEnabled: user.twoFAEnabled || false,
      customAvatarUrl: user.customAvatarUrl,
      boringAvatarStyle: user.boringAvatarStyle,
      boringAvatarColors: user.boringAvatarColors,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
  }
}

// Export singleton instance
module.exports = new DataSanitizer();