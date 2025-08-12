const log = new (require("cat-loggr"))();

/**
 * Comprehensive input validation middleware
 */
class InputValidator {
  
  /**
   * Validate username
   */
  static validateUsername(username) {
    const errors = [];
    
    if (!username || typeof username !== 'string') {
      errors.push('Username is required');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    if (username.length > 30) {
      errors.push('Username must be no more than 30 characters long');
    }
    
    // Character validation - alphanumeric, underscore, hyphen only
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }
    
    // Must start with letter or number
    if (!/^[a-zA-Z0-9]/.test(username)) {
      errors.push('Username must start with a letter or number');
    }
    
    // Reserved usernames
    const reserved = ['admin', 'root', 'administrator', 'system', 'api', 'www', 'mail', 'ftp', 'test', 'guest', 'null', 'undefined'];
    if (reserved.includes(username.toLowerCase())) {
      errors.push('This username is reserved and cannot be used');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: username.trim().toLowerCase()
    };
  }
  
  /**
   * Validate email
   */
  static validateEmail(email) {
    const errors = [];
    
    if (!email || typeof email !== 'string') {
      errors.push('Email is required');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (email.length > 254) {
      errors.push('Email address is too long');
    }
    
    // Format validation using built-in regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }
    
    // Domain validation (basic)
    const domain = email.split('@')[1];
    if (domain && domain.length > 253) {
      errors.push('Email domain is too long');
    }
    
    // Disposable email check (basic list)
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
      'mailinator.com', 'yopmail.com', 'temp-mail.org'
    ];
    if (domain && disposableDomains.includes(domain.toLowerCase())) {
      errors.push('Disposable email addresses are not allowed');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized: email.trim().toLowerCase()
    };
  }
  
  /**
   * Validate password
   */
  static validatePassword(password) {
    const errors = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }
    
    // Length validation
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }
    
    // Complexity validation
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    let complexityScore = 0;
    if (hasLowercase) complexityScore++;
    if (hasUppercase) complexityScore++;
    if (hasNumbers) complexityScore++;
    if (hasSpecialChar) complexityScore++;
    
    if (complexityScore < 3) {
      errors.push('Password must contain at least 3 of the following: lowercase letters, uppercase letters, numbers, special characters');
    }
    
    // Common password check
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('This password is too common. Please choose a more secure password');
    }
    
    // Sequential characters check
    if (/123456|abcdef|qwerty/i.test(password)) {
      errors.push('Password should not contain sequential characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.getPasswordStrength(password)
    };
  }
  
  /**
   * Get password strength score
   */
  static getPasswordStrength(password) {
    let score = 0;
    
    // Length bonus
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
    
    // Bonus for mixed case and numbers
    if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score += 1;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    if (score <= 6) return 'strong';
    return 'very-strong';
  }
  
  /**
   * Sanitize general text input
   */
  static sanitizeText(text, maxLength = 255) {
    if (!text || typeof text !== 'string') return '';
    
    // Remove HTML tags and trim
    let sanitized = text.replace(/<[^>]*>/g, '').trim();
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized;
  }
  
  /**
   * Validate and sanitize form data
   */
  static validateRegistrationForm(data) {
    const { username, email, password } = data;
    const errors = [];
    const sanitized = {};
    
    // Validate username
    const usernameValidation = this.validateUsername(username);
    if (!usernameValidation.isValid) {
      errors.push(...usernameValidation.errors);
    } else {
      sanitized.username = usernameValidation.sanitized;
    }
    
    // Validate email
    const emailValidation = this.validateEmail(email);
    if (!emailValidation.isValid) {
      errors.push(...emailValidation.errors);
    } else {
      sanitized.email = emailValidation.sanitized;
    }
    
    // Validate password
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    } else {
      sanitized.password = password; // Don't modify password
      sanitized.passwordStrength = passwordValidation.strength;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }
  
  /**
   * Validate login form
   */
  static validateLoginForm(data) {
    const { username, password } = data;
    const errors = [];
    const sanitized = {};
    
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      errors.push('Username or email is required');
    } else {
      // Could be username or email
      const trimmed = username.trim();
      if (trimmed.includes('@')) {
        const emailValidation = this.validateEmail(trimmed);
        if (!emailValidation.isValid) {
          errors.push('Please enter a valid email address');
        } else {
          sanitized.username = emailValidation.sanitized;
        }
      } else {
        sanitized.username = trimmed.toLowerCase();
      }
    }
    
    if (!password || typeof password !== 'string' || password.length === 0) {
      errors.push('Password is required');
    } else {
      sanitized.password = password;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }
  
  /**
   * Express middleware for form validation
   */
  static createValidationMiddleware(validationType) {
    return (req, res, next) => {
      let validation;
      
      switch (validationType) {
        case 'registration':
          validation = this.validateRegistrationForm(req.body);
          break;
        case 'login':
          validation = this.validateLoginForm(req.body);
          break;
        default:
          return next();
      }
      
      if (!validation.isValid) {
        log.warn(`Validation failed for ${validationType}:`, validation.errors);
        
        // For registration, redirect with errors
        if (validationType === 'registration') {
          const errorMsg = validation.errors.join('; ');
          return res.redirect(`/register?err=${encodeURIComponent(errorMsg)}`);
        }
        
        // For login, redirect with generic error
        if (validationType === 'login') {
          return res.redirect('/login?err=InvalidInput');
        }
        
        return res.status(400).json({ errors: validation.errors });
      }
      
      // Replace req.body with sanitized data
      req.body = { ...req.body, ...validation.sanitized };
      req.validationResult = validation;
      
      next();
    };
  }
}

module.exports = {
  InputValidator,
  validateRegistration: InputValidator.createValidationMiddleware('registration'),
  validateLogin: InputValidator.createValidationMiddleware('login')
};