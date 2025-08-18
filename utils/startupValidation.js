/**
 * @fileoverview Startup validation utility
 * Validates that the application is properly configured before starting
 */

const fs = require('fs');
const path = require('path');

class StartupValidation {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Run all startup validations
   * @returns {Object} Validation results
   */
  validate() {
    console.log('🔍 Running startup validation...');

    this.validateEnvironment();
    this.validateConfiguration();
    this.validateSecurity();
    this.validateFiles();

    const results = {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };

    this.displayResults(results);
    return results;
  }

  /**
   * Validate environment setup
   */
  validateEnvironment() {
    // Check if .env file exists
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      this.warnings.push({
        type: 'ENVIRONMENT',
        message: '.env file not found. Using default configuration values.',
        suggestion: 'Copy .env.example to .env and configure your environment variables'
      });
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      this.errors.push({
        type: 'NODE_VERSION',
        message: `Node.js ${nodeVersion} is not supported. Minimum required: 16.x`,
        suggestion: 'Please upgrade to Node.js 16.x or higher'
      });
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    try {
      const configManager = require('./configManager');
      
      // Validate required configuration
      const requiredFields = ['port', 'baseUri', 'domain'];
      requiredFields.forEach(field => {
        const value = configManager.get(field);
        if (!value) {
          this.errors.push({
            type: 'CONFIGURATION',
            message: `Required configuration field '${field}' is missing`,
            suggestion: `Set ${field.toUpperCase()} in your .env file`
          });
        }
      });

      // Validate session secret
      const sessionSecret = configManager.get('session_secret');
      if (!sessionSecret) {
        this.errors.push({
          type: 'SECURITY',
          message: 'Session secret is not configured',
          suggestion: 'Run "npm run regen-secret" to generate a secure session secret'
        });
      } else if (sessionSecret.length < 32) {
        this.errors.push({
          type: 'SECURITY',
          message: 'Session secret is too short (less than 32 characters)',
          suggestion: 'Run "npm run regen-secret" to generate a secure session secret'
        });
      } else if (sessionSecret === 'secret' || sessionSecret === 'Random') {
        this.errors.push({
          type: 'SECURITY',
          message: 'Session secret is using default/weak value',
          suggestion: 'Run "npm run regen-secret" to generate a secure session secret'
        });
      }

      // Validate database configuration
      const databaseURL = configManager.get('databaseURL');
      if (!databaseURL) {
        this.errors.push({
          type: 'DATABASE',
          message: 'Database URL is not configured',
          suggestion: 'Set DATABASE_URL in your .env file'
        });
      }

      // Validate port
      const port = configManager.get('port');
      if (port && (isNaN(port) || port < 1 || port > 65535)) {
        this.errors.push({
          type: 'CONFIGURATION',
          message: `Invalid port number: ${port}`,
          suggestion: 'Set a valid port number (1-65535) in PORT environment variable'
        });
      }

    } catch (error) {
      this.errors.push({
        type: 'CONFIGURATION',
        message: `Configuration validation failed: ${error.message}`,
        suggestion: 'Check your configuration files for syntax errors'
      });
    }
  }

  /**
   * Validate security configuration
   */
  validateSecurity() {
    try {
      const configManager = require('./configManager');
      
      // Check if running in production mode
      const mode = configManager.get('mode');
      if (mode === 'development') {
        this.warnings.push({
          type: 'SECURITY',
          message: 'Application is running in development mode',
          suggestion: 'Set NODE_ENV=production for production deployments'
        });
      }

      // Check HTTPS configuration
      const baseUri = configManager.get('baseUri');
      if (baseUri && !baseUri.startsWith('https://') && mode === 'production') {
        this.warnings.push({
          type: 'SECURITY',
          message: 'Base URI is not using HTTPS in production mode',
          suggestion: 'Use HTTPS in production for security'
        });
      }

    } catch (error) {
      this.warnings.push({
        type: 'SECURITY',
        message: `Security validation failed: ${error.message}`
      });
    }
  }

  /**
   * Validate required files and directories
   */
  validateFiles() {
    const requiredFiles = [
      'package.json',
      'index.js',
      'handlers/db.js',
      'utils/configManager.js'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        this.errors.push({
          type: 'FILES',
          message: `Required file missing: ${file}`,
          suggestion: 'Ensure all application files are present'
        });
      }
    });

    // Check if database file exists (for SQLite)
    try {
      const configManager = require('./configManager');
      const databaseURL = configManager.get('databaseURL');
      
      if (databaseURL && databaseURL.startsWith('sqlite://')) {
        const dbFile = databaseURL.replace('sqlite://', '');
        const dbPath = path.join(process.cwd(), dbFile);
        
        if (!fs.existsSync(dbPath)) {
          this.warnings.push({
            type: 'DATABASE',
            message: `SQLite database file not found: ${dbFile}`,
            suggestion: 'Database will be created automatically on first run'
          });
        }
      }
    } catch (error) {
      // Ignore errors in file validation
    }
  }

  /**
   * Display validation results
   */
  displayResults(results) {
    console.log('');

    if (results.errors.length > 0) {
      console.log('❌ Startup validation failed:');
      results.errors.forEach(error => {
        console.log(`   [${error.type}] ${error.message}`);
        if (error.suggestion) {
          console.log(`   → ${error.suggestion}`);
        }
      });
      console.log('');
    }

    if (results.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      results.warnings.forEach(warning => {
        console.log(`   [${warning.type}] ${warning.message}`);
        if (warning.suggestion) {
          console.log(`   → ${warning.suggestion}`);
        }
      });
      console.log('');
    }

    if (results.success) {
      console.log('✅ Startup validation passed');
    } else {
      console.log('❌ Startup validation failed - please fix the errors above');
    }

    console.log('');
  }
}

module.exports = new StartupValidation();