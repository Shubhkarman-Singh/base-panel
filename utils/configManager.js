/**
 * @fileoverview Secure configuration manager that handles sensitive configuration data
 * Provides environment variable support and secure credential management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env file
try {
  require('dotenv').config();
} catch (error) {
  // dotenv is optional - if not installed, just use system environment variables
  console.log('dotenv not available, using system environment variables only');
}

class ConfigManager {
  constructor() {
    this.config = null;
    this.sensitiveFields = [
      'session_secret',
      'databaseURL',
      'smtp_password',
      'smtp_user',
      'api_secret',
      'encryption_key'
    ];
  }

  /**
   * Load configuration from environment variables only
   */
  loadConfig() {
    if (this.config) return this.config;

    // Build configuration from environment variables only
    this.config = {
      // Database configuration
      databaseURL: process.env.DATABASE_URL || 'sqlite://impulse.db',
      databaseTable: process.env.DATABASE_TABLE || 'impulse',
      
      // Session configuration
      session_secret: process.env.SESSION_SECRET,
      
      // Server configuration
      port: parseInt(process.env.PORT) || 3000,
      baseUri: process.env.BASE_URI || 'http://localhost:3000',
      domain: process.env.DOMAIN || 'localhost',
      mode: process.env.NODE_ENV || 'production',
      
      // Application settings
      version: process.env.VERSION || '0.0.1',
      versionState: process.env.VERSION_STATE || 'alpha',
      saltRounds: parseInt(process.env.SALT_ROUNDS) || 10,
      ogTitle: process.env.OG_TITLE || 'Impulse Panel',
      ogDescription: process.env.OG_DESCRIPTION || 'This is an instance of the Impulse Panel',
      
      // Email configuration (optional)
      smtp_host: process.env.SMTP_HOST,
      smtp_port: parseInt(process.env.SMTP_PORT) || undefined,
      smtp_user: process.env.SMTP_USER,
      smtp_password: process.env.SMTP_PASSWORD,
      
      // Other sensitive configs (optional)
      api_secret: process.env.API_SECRET,
      encryption_key: process.env.ENCRYPTION_KEY
    };

    return this.config;
  }

  /**
   * Get configuration value with environment variable fallback
   */
  get(key) {
    const config = this.loadConfig();
    return config[key];
  }

  /**
   * Get sanitized configuration for logging (removes sensitive data)
   */
  getSanitizedConfig() {
    const config = this.loadConfig();
    const sanitized = { ...config };

    // Remove or mask sensitive fields
    this.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        if (typeof sanitized[field] === 'string' && sanitized[field].length > 8) {
          // Show first 4 and last 4 characters for identification
          sanitized[field] = `${sanitized[field].substring(0, 4)}...${sanitized[field].substring(sanitized[field].length - 4)}`;
        } else {
          sanitized[field] = '[REDACTED]';
        }
      }
    });

    return sanitized;
  }

  /**
   * Validate required configuration
   */
  validateConfig() {
    const config = this.loadConfig();
    const required = ['databaseURL', 'port'];
    const missing = [];

    required.forEach(field => {
      if (!config[field]) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}. Please check your .env file or environment variables.`);
    }

    // Validate session secret if provided
    if (config.session_secret && config.session_secret.length < 32) {
      throw new Error('Session secret must be at least 32 characters long');
    }

    // Warn if session secret is missing
    if (!config.session_secret) {
      console.warn('⚠️  WARNING: No session secret configured. Sessions will not be secure!');
      console.warn('   Set SESSION_SECRET in your .env file or run: npm run regen-secret');
    }

    return true;
  }

  /**
   * Generate secure database URL with environment variable support
   */
  getDatabaseConfig() {
    const databaseURL = this.get('databaseURL');
    
    if (!databaseURL) {
      throw new Error('Database URL not configured');
    }

    // Parse database URL to extract components
    if (databaseURL.startsWith('sqlite://')) {
      return {
        type: 'sqlite',
        url: databaseURL,
        file: databaseURL.replace('sqlite://', '') || 'impulse.db'
      };
    } else if (databaseURL.startsWith('mysql://')) {
      // Parse MySQL URL
      const url = new URL(databaseURL);
      return {
        type: 'mysql',
        url: databaseURL,
        host: url.hostname,
        port: url.port || 3306,
        database: url.pathname.substring(1),
        username: url.username,
        // Don't store password in memory longer than necessary
        hasPassword: !!url.password
      };
    } else {
      throw new Error('Unsupported database type');
    }
  }

  /**
   * Create environment file template
   */
  createEnvTemplate() {
    const template = `# Impulse Panel Environment Configuration
# Copy this file to .env and fill in your values
# DO NOT commit .env to version control

# Database Configuration
DATABASE_URL=sqlite://impulse.db
# For MySQL: DATABASE_URL=mysql://username:password@localhost:3306/database_name

# Session Security
SESSION_SECRET=${crypto.randomBytes(64).toString('hex')}

# Server Configuration
PORT=3000
BASE_URI=http://localhost:3000
DOMAIN=localhost
NODE_ENV=production

# Email Configuration (Optional)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# API Security (Optional)
# API_SECRET=${crypto.randomBytes(32).toString('hex')}
# ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
`;

    fs.writeFileSync('.env.template', template);
    return template;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment() {
    return this.get('mode') === 'development' || process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction() {
    return this.get('mode') === 'production' || process.env.NODE_ENV === 'production';
  }
}

// Export singleton instance
module.exports = new ConfigManager();