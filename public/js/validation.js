/**
 * Client-side validation for better user experience
 */
class ClientValidator {
  
  static validateUsername(username) {
    const errors = [];
    
    if (!username || username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    if (username && username.length > 30) {
      errors.push('Username must be no more than 30 characters long');
    }
    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }
    if (username && !/^[a-zA-Z0-9]/.test(username)) {
      errors.push('Username must start with a letter or number');
    }
    
    const reserved = ['admin', 'root', 'administrator', 'system', 'api', 'www', 'mail', 'ftp', 'test', 'guest'];
    if (username && reserved.includes(username.toLowerCase())) {
      errors.push('This username is reserved and cannot be used');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateEmail(email) {
    const errors = [];
    
    if (!email) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Please enter a valid email address');
      }
      if (email.length > 254) {
        errors.push('Email address is too long');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validatePassword(password) {
    const errors = [];
    
    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      if (password.length > 128) {
        errors.push('Password must be no more than 128 characters long');
      }
      
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
        errors.push('Password must contain at least 3 of: lowercase, uppercase, numbers, special characters');
      }
      
      const commonPasswords = ['password', '123456', '123456789', 'qwerty', 'abc123', 'password123'];
      if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('This password is too common');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.getPasswordStrength(password)
    };
  }
  
  static getPasswordStrength(password) {
    if (!password) return 'none';
    
    let score = 0;
    
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    if (score <= 5) return 'strong';
    return 'very-strong';
  }
  
  static showValidationErrors(fieldId, errors) {
    const field = document.getElementById(fieldId);
    const errorContainer = document.getElementById(fieldId + '-errors');
    
    if (field) {
      if (errors.length > 0) {
        field.classList.add('border-red-500');
        field.classList.remove('border-green-500');
      } else {
        field.classList.add('border-green-500');
        field.classList.remove('border-red-500');
      }
    }
    
    if (errorContainer) {
      if (errors.length > 0) {
        errorContainer.innerHTML = errors.map(error => 
          `<div class="text-red-500 text-sm mt-1">${error}</div>`
        ).join('');
        errorContainer.style.display = 'block';
      } else {
        errorContainer.style.display = 'none';
      }
    }
  }
  
  static showPasswordStrength(password, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const strength = this.getPasswordStrength(password);
    const colors = {
      'none': 'bg-gray-300',
      'weak': 'bg-red-500',
      'medium': 'bg-yellow-500',
      'strong': 'bg-blue-500',
      'very-strong': 'bg-green-500'
    };
    
    const widths = {
      'none': '0%',
      'weak': '25%',
      'medium': '50%',
      'strong': '75%',
      'very-strong': '100%'
    };
    
    container.innerHTML = `
      <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div class="h-2 rounded-full transition-all duration-300 ${colors[strength]}" 
             style="width: ${widths[strength]}"></div>
      </div>
      <div class="text-sm mt-1 capitalize">${strength.replace('-', ' ')} password</div>
    `;
  }
}

// Auto-attach validation to forms
document.addEventListener('DOMContentLoaded', function() {
  
  // Registration form validation
  const registerForm = document.querySelector('form[action*="register"]');
  if (registerForm) {
    const usernameField = registerForm.querySelector('input[name="username"]');
    const emailField = registerForm.querySelector('input[name="email"]');
    const passwordField = registerForm.querySelector('input[name="password"]');
    
    if (usernameField) {
      usernameField.addEventListener('blur', function() {
        const validation = ClientValidator.validateUsername(this.value);
        ClientValidator.showValidationErrors('username', validation.errors);
      });
    }
    
    if (emailField) {
      emailField.addEventListener('blur', function() {
        const validation = ClientValidator.validateEmail(this.value);
        ClientValidator.showValidationErrors('email', validation.errors);
      });
    }
    
    if (passwordField) {
      passwordField.addEventListener('input', function() {
        const validation = ClientValidator.validatePassword(this.value);
        ClientValidator.showValidationErrors('password', validation.errors);
        ClientValidator.showPasswordStrength(this.value, 'password-strength');
      });
    }
  }
  
  // Login form validation
  const loginForm = document.querySelector('form[action*="login"]');
  if (loginForm) {
    const usernameField = loginForm.querySelector('input[name="username"]');
    const passwordField = loginForm.querySelector('input[name="password"]');
    
    if (usernameField) {
      usernameField.addEventListener('blur', function() {
        if (this.value.includes('@')) {
          const validation = ClientValidator.validateEmail(this.value);
          ClientValidator.showValidationErrors('username', validation.errors);
        } else {
          const validation = ClientValidator.validateUsername(this.value);
          ClientValidator.showValidationErrors('username', validation.errors);
        }
      });
    }
  }
  
});