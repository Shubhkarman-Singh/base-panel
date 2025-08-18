/**
 * Input Validation Utility
 * Provides comprehensive validation for user inputs
 */

class InputValidator {
  /**
   * Validates username format and security requirements
   * @param {string} username - Username to validate
   * @returns {Object} - Validation result with isValid boolean and errors array
   */
  static validateUsername(username) {
    const errors = [];
    
    if (!username) {
      errors.push('Username is required');
      return { isValid: false, errors };
    }
    
    if (typeof username !== 'string') {
      errors.push('Username must be a string');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    
    if (username.length > 30) {
      errors.push('Username must be no more than 30 characters long');
    }
    
    // Character validation
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }
    
    // Must start with letter or number
    if (!/^[a-zA-Z0-9]/.test(username)) {
      errors.push('Username must start with a letter or number');
    }
    
    // Reserved usernames
    const reserved = [
      'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail', 'ftp',
      'test', 'guest', 'user', 'support', 'help', 'info', 'null', 'undefined'
    ];
    
    if (reserved.includes(username.toLowerCase())) {
      errors.push('This username is reserved and cannot be used');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates password strength and security requirements
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result with isValid boolean and errors array
   */
  static validatePassword(password) {
    const errors = [];
    
    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }
    
    if (typeof password !== 'string') {
      errors.push('Password must be a string');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }
    
    // Complexity requirements
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }
    
    // Common password patterns
    const commonPatterns = [
      /^(.)\1+$/, // All same character
      /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
      /^(qwerty|asdfgh|zxcvbn|password|admin|login)/i
    ];
    
    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns and is not secure');
        break;
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates email format
   * @param {string} email - Email to validate
   * @returns {Object} - Validation result with isValid boolean and errors array
   */
  static validateEmail(email) {
    const errors = [];
    
    if (!email) {
      errors.push('Email is required');
      return { isValid: false, errors };
    }
    
    if (typeof email !== 'string') {
      errors.push('Email must be a string');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (email.length > 254) {
      errors.push('Email address is too long');
    }
    
    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
    
    // Check for dangerous characters
    if (/[<>'"&]/.test(email)) {
      errors.push('Email contains invalid characters');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates URL format
   * @param {string} url - URL to validate
   * @returns {Object} - Validation result with isValid boolean and errors array
   */
  static validateURL(url) {
    const errors = [];
    
    if (!url) {
      errors.push('URL is required');
      return { isValid: false, errors };
    }
    
    if (typeof url !== 'string') {
      errors.push('URL must be a string');
      return { isValid: false, errors };
    }
    
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        errors.push('URL must use HTTP or HTTPS protocol');
      }
      
      // Check for dangerous characters in hostname
      if (/[<>'"&]/.test(urlObj.hostname)) {
        errors.push('URL contains invalid characters');
      }
      
      // Prevent localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname === '127.0.0.1' || 
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.')) {
          errors.push('Private IP addresses and localhost are not allowed');
        }
      }
      
    } catch (error) {
      errors.push('Invalid URL format');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  /**
   * Sanitizes string input to prevent XSS
   * @param {string} input - Input to sanitize
   * @returns {string} - Sanitized input
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/[<>'"&]/g, (match) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[match];
      })
      .trim();
  }

  /**
   * Validates file upload
   * @param {Object} file - Multer file object
   * @param {Array} allowedTypes - Array of allowed MIME types
   * @param {number} maxSize - Maximum file size in bytes
   * @returns {Object} - Validation result
   */
  static validateFileUpload(file, allowedTypes = [], maxSize = 5 * 1024 * 1024) {
    const errors = [];
    
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }
    
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`);
    }
    
    // Check MIME type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }
    
    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.jsp'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(fileExtension)) {
      errors.push(`File extension ${fileExtension} is not allowed for security reasons`);
    }
    
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * Middleware to validate login input
 */
function validateLogin(req, res, next) {
  const { username, password } = req.body;
  const errors = [];

  // Validate username/email
  if (!username) {
    errors.push('Username or email is required');
  } else if (typeof username !== 'string') {
    errors.push('Username must be a string');
  } else if (username.length > 100) {
    errors.push('Username is too long');
  }

  // Validate password
  if (!password) {
    errors.push('Password is required');
  } else if (typeof password !== 'string') {
    errors.push('Password must be a string');
  } else if (password.length > 200) {
    errors.push('Password is too long');
  }

  if (errors.length > 0) {
    return res.redirect('/login?err=' + encodeURIComponent(errors.join('; ')));
  }

  next();
}

/**
 * Middleware to validate registration input
 */
function validateRegistration(req, res, next) {
  const { username, email, password } = req.body;
  const errors = [];

  // Validate username
  const usernameValidation = InputValidator.validateUsername(username);
  if (!usernameValidation.isValid) {
    errors.push(...usernameValidation.errors);
  }

  // Validate email
  const emailValidation = InputValidator.validateEmail(email);
  if (!emailValidation.isValid) {
    errors.push(...emailValidation.errors);
  }

  // Validate password
  const passwordValidation = InputValidator.validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors);
  }

  if (errors.length > 0) {
    return res.redirect('/register?err=' + encodeURIComponent(errors.join('; ')));
  }

  next();
}

module.exports = { 
  InputValidator,
  validateLogin,
  validateRegistration
};