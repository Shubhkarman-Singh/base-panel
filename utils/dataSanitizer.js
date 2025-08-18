/**
 * Data Sanitizer Utility
 * Provides secure data filtering and sanitization for API responses and templates
 */

class DataSanitizer {
  /**
   * Removes sensitive fields from settings object
   * @param {Object} settings - Settings object
   * @returns {Object} - Sanitized settings
   */
  static removeSensitiveFields(settings) {
    if (!settings || typeof settings !== 'object') {
      return {};
    }

    const sanitized = { ...settings };
    
    // Remove sensitive configuration
    delete sanitized.sessionSecret;
    delete sanitized.jwtSecret;
    delete sanitized.encryptionKey;
    delete sanitized.smtpPassword;
    delete sanitized.databaseUrl;
    delete sanitized.apiKeys;
    delete sanitized.webhookSecrets;
    
    return sanitized;
  }

  /**
   * Sanitizes user data for public consumption
   * @param {Array} users - Array of user objects
   * @param {Object} options - Sanitization options
   * @returns {Array} - Sanitized user array
   */
  static sanitizeUsers(users, options = {}) {
    if (!Array.isArray(users)) {
      return [];
    }

    const {
      includeEmail = false,
      includeAdminStatus = false,
      includePersonalData = false
    } = options;

    return users.map(user => {
      const sanitized = {
        userId: user.userId,
        username: user.username,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      };

      if (includeEmail && user.email) {
        sanitized.email = user.email;
      }

      if (includeAdminStatus) {
        sanitized.admin = user.admin || false;
      }

      if (includePersonalData) {
        sanitized.displayName = user.displayName;
        sanitized.avatar = user.avatar;
        sanitized.customAvatarUrl = user.customAvatarUrl;
        sanitized.boringAvatarStyle = user.boringAvatarStyle;
        sanitized.boringAvatarColors = user.boringAvatarColors;
      }

      // Never include sensitive data
      // password, twoFASecret, twoFABackupCodes, etc. are intentionally omitted

      return sanitized;
    });
  }

  /**
   * Creates a safe user profile for the current user
   * @param {Object} user - User object
   * @returns {Object} - Safe user profile
   */
  static createUserProfile(user) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      admin: user.admin || false,
      twoFAEnabled: user.twoFAEnabled || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      avatar: user.avatar,
      customAvatarUrl: user.customAvatarUrl,
      boringAvatarStyle: user.boringAvatarStyle,
      boringAvatarColors: user.boringAvatarColors,
      lang: user.lang
    };
  }

  /**
   * Sanitizes error objects for logging and responses
   * @param {Error} error - Error object
   * @returns {Object} - Sanitized error data
   */
  static sanitizeError(error) {
    if (!error) {
      return null;
    }

    const sanitized = {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status || error.statusCode
    };

    // Only include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      sanitized.stack = error.stack;
    }

    return sanitized;
  }

  /**
   * Sanitizes request data for logging
   * @param {Object} req - Express request object
   * @returns {Object} - Sanitized request data
   */
  static sanitizeRequest(req) {
    if (!req) {
      return {};
    }

    const sanitized = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    if (req.user) {
      sanitized.userId = req.user.userId;
      sanitized.username = req.user.username;
    }

    // Never log sensitive data from body or headers
    // passwords, tokens, etc. should not be logged

    return sanitized;
  }

  /**
   * Sanitizes HTML content to prevent XSS
   * @param {string} html - HTML content
   * @returns {string} - Sanitized HTML
   */
  static sanitizeHTML(html) {
    if (typeof html !== 'string') {
      return '';
    }

    // Basic HTML sanitization - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '')
      .trim();
  }

  /**
   * Validates and sanitizes configuration data
   * @param {Object} config - Configuration object
   * @returns {Object} - Sanitized configuration
   */
  static sanitizeConfig(config) {
    if (!config || typeof config !== 'object') {
      return {};
    }

    const sanitized = {};
    const allowedFields = [
      'name', 'version', 'mode', 'port', 'baseUri',
      'ogTitle', 'ogDescription', 'theme', 'language',
      'timezone', 'dateFormat', 'unitPrefix'
    ];

    allowedFields.forEach(field => {
      if (config[field] !== undefined) {
        sanitized[field] = config[field];
      }
    });

    return sanitized;
  }

  /**
   * Sanitizes database query results
   * @param {*} data - Database query result
   * @param {Array} sensitiveFields - Fields to remove
   * @returns {*} - Sanitized data
   */
  static sanitizeDbResult(data, sensitiveFields = []) {
    if (!data) {
      return data;
    }

    const defaultSensitiveFields = [
      'password', 'twoFASecret', 'twoFABackupCodes', 'sessionSecret',
      'jwtSecret', 'encryptionKey', 'apiKey', 'webhookSecret'
    ];

    const fieldsToRemove = [...defaultSensitiveFields, ...sensitiveFields];

    if (Array.isArray(data)) {
      return data.map(item => this.removeFields(item, fieldsToRemove));
    } else if (typeof data === 'object') {
      return this.removeFields(data, fieldsToRemove);
    }

    return data;
  }

  /**
   * Removes specified fields from an object
   * @param {Object} obj - Object to sanitize
   * @param {Array} fields - Fields to remove
   * @returns {Object} - Sanitized object
   */
  static removeFields(obj, fields) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj };
    fields.forEach(field => {
      delete sanitized[field];
    });

    return sanitized;
  }

  /**
   * Validates and sanitizes pagination parameters
   * @param {Object} query - Query parameters
   * @returns {Object} - Sanitized pagination
   */
  static sanitizePagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Sanitizes sort parameters
   * @param {string} sortBy - Field to sort by
   * @param {string} sortOrder - Sort order (asc/desc)
   * @param {Array} allowedFields - Allowed sort fields
   * @returns {Object} - Sanitized sort parameters
   */
  static sanitizeSort(sortBy, sortOrder, allowedFields = []) {
    const sanitizedSortBy = allowedFields.includes(sortBy) ? sortBy : allowedFields[0] || 'createdAt';
    const sanitizedSortOrder = ['asc', 'desc'].includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

    return {
      sortBy: sanitizedSortBy,
      sortOrder: sanitizedSortOrder
    };
  }
}

module.exports = DataSanitizer;