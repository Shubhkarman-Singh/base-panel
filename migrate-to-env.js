#!/usr/bin/env node

/**
 * @fileoverview Migration script to move from config.json to environment variables
 * This script safely migrates existing configuration to the new secure environment-based system
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ConfigMigration {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.envPath = path.join(process.cwd(), '.env');
    this.envExamplePath = path.join(process.cwd(), '.env.example');
    this.backupPath = `${this.configPath}.backup.${Date.now()}`;
  }

  async migrate() {
    console.log('🔄 Impulse Panel Configuration Migration');
    console.log('========================================');
    console.log('');

    try {
      // Step 1: Validate prerequisites
      await this.validatePrerequisites();

      // Step 2: Backup existing config
      await this.backupConfig();

      // Step 3: Read current configuration
      const config = await this.readCurrentConfig();

      // Step 4: Create .env file
      await this.createEnvFile(config);

      // Step 5: Update config.json (remove sensitive data)
      await this.updateConfigJson(config);

      // Step 6: Verify migration
      await this.verifyMigration();

      console.log('');
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('🔧 Next steps:');
      console.log('1. Review the generated .env file');
      console.log('2. Add .env to your .gitignore (if not already present)');
      console.log('3. Restart your application');
      console.log('4. Test that everything works correctly');
      console.log('5. Keep the backup file safe until you\'re sure everything works');
      console.log('');
      console.log('⚠️  IMPORTANT: Never commit .env to version control!');

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('1. Make sure you have write permissions in this directory');
      console.log('2. Ensure config.json exists and is valid JSON');
      console.log('3. Check that no other process is using the files');
      process.exit(1);
    }
  }

  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');

    // Check if config.json exists
    if (!fs.existsSync(this.configPath)) {
      throw new Error('config.json not found. Please ensure you\'re in the correct directory.');
    }

    // Check if config.json is valid JSON
    try {
      JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      throw new Error('config.json contains invalid JSON. Please fix the syntax errors first.');
    }

    // Check write permissions
    try {
      fs.accessSync(process.cwd(), fs.constants.W_OK);
    } catch (error) {
      throw new Error('No write permission in current directory. Please check your permissions.');
    }

    console.log('✅ Prerequisites validated');
  }

  async backupConfig() {
    console.log('📋 Creating backup of config.json...');
    
    try {
      fs.copyFileSync(this.configPath, this.backupPath);
      console.log(`✅ Backup created: ${path.basename(this.backupPath)}`);
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  async readCurrentConfig() {
    console.log('📖 Reading current configuration...');
    
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      console.log('✅ Configuration loaded successfully');
      return config;
    } catch (error) {
      throw new Error(`Failed to read config.json: ${error.message}`);
    }
  }

  async createEnvFile(config) {
    console.log('📝 Creating .env file...');

    // Check if .env already exists
    if (fs.existsSync(this.envPath)) {
      const answer = await this.askQuestion('⚠️  .env file already exists. Overwrite? (y/N): ');
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('ℹ️  Skipping .env file creation');
        return;
      }
    }

    // Generate secure session secret if current one is weak
    let sessionSecret = config.session_secret;
    if (!sessionSecret || sessionSecret === 'Random' || sessionSecret === 'secret' || sessionSecret.length < 32) {
      sessionSecret = crypto.randomBytes(64).toString('hex');
      console.log('🔐 Generated new secure session secret');
    }

    // Create .env content
    const envContent = this.generateEnvContent(config, sessionSecret);

    try {
      fs.writeFileSync(this.envPath, envContent);
      console.log('✅ .env file created successfully');
    } catch (error) {
      throw new Error(`Failed to create .env file: ${error.message}`);
    }
  }

  generateEnvContent(config, sessionSecret) {
    const timestamp = new Date().toISOString();
    
    return `# Impulse Panel Environment Configuration
# Migrated from config.json on ${timestamp}
# DO NOT commit this file to version control

# ==============================================
# CRITICAL SECURITY SETTINGS
# ==============================================

# Session Security
SESSION_SECRET=${sessionSecret}

# Database Configuration
DATABASE_URL=${config.databaseURL || 'sqlite://impulse.db'}

# ==============================================
# SERVER CONFIGURATION
# ==============================================

# Server Settings
PORT=${config.port || 3000}
BASE_URI=${config.baseUri || 'http://localhost:3000'}
DOMAIN=${config.domain || 'localhost'}

# Environment Mode
NODE_ENV=${config.mode || 'production'}

# ==============================================
# APPLICATION SETTINGS
# ==============================================

# Database Table
DATABASE_TABLE=${config.databaseTable || 'impulse'}

# Salt Rounds for password hashing
SALT_ROUNDS=${config.saltRounds || 10}

# Application Metadata
VERSION=${config.version || '0.0.1'}
VERSION_STATE=${config.versionState || 'alpha'}
OG_TITLE=${config.ogTitle || 'Impulse Panel'}
OG_DESCRIPTION=${config.ogDescription || 'This is an instance of the Impulse Panel'}

# ==============================================
# EMAIL CONFIGURATION (Optional)
# ==============================================

# SMTP Settings for email functionality
${config.smtp_host ? `SMTP_HOST=${config.smtp_host}` : '# SMTP_HOST=smtp.gmail.com'}
${config.smtp_port ? `SMTP_PORT=${config.smtp_port}` : '# SMTP_PORT=587'}
${config.smtp_user ? `SMTP_USER=${config.smtp_user}` : '# SMTP_USER=your-email@gmail.com'}
${config.smtp_password ? `SMTP_PASSWORD=${config.smtp_password}` : '# SMTP_PASSWORD=your-app-password'}

# ==============================================
# ADDITIONAL SECURITY (Optional)
# ==============================================

# API Security
${config.api_secret ? `API_SECRET=${config.api_secret}` : '# API_SECRET=your_secure_api_secret_here'}

# Encryption Key for sensitive data
${config.encryption_key ? `ENCRYPTION_KEY=${config.encryption_key}` : '# ENCRYPTION_KEY=your_32_byte_encryption_key_here'}
`;
  }

  async updateConfigJson(config) {
    console.log('🔧 Updating config.json (removing sensitive data)...');

    // Create new config with only non-sensitive data
    const newConfig = {
      note: "Configuration has been migrated to environment variables for security. See .env.example for setup instructions.",
      version: config.version || "0.0.1",
      versionState: config.versionState || "alpha",
      baseUri: config.baseUri || "http://localhost:3000",
      port: config.port || 3000,
      domain: config.domain || "localhost",
      mode: config.mode || "production",
      databaseTable: config.databaseTable || "impulse",
      saltRounds: config.saltRounds || 10,
      ogTitle: config.ogTitle || "Impulse Panel",
      ogDescription: config.ogDescription || "This is an instance of the Impulse Panel - learn more at github.com/impulseOSS"
    };

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2));
      console.log('✅ config.json updated (sensitive data removed)');
    } catch (error) {
      throw new Error(`Failed to update config.json: ${error.message}`);
    }
  }

  async verifyMigration() {
    console.log('🔍 Verifying migration...');

    // Check if .env file exists and has content
    if (!fs.existsSync(this.envPath)) {
      throw new Error('.env file was not created');
    }

    const envContent = fs.readFileSync(this.envPath, 'utf8');
    if (!envContent.includes('SESSION_SECRET=')) {
      throw new Error('.env file does not contain SESSION_SECRET');
    }

    // Check if config.json was updated
    const configContent = fs.readFileSync(this.configPath, 'utf8');
    const config = JSON.parse(configContent);
    if (config.session_secret) {
      console.log('⚠️  Warning: config.json still contains session_secret');
    }

    console.log('✅ Migration verification completed');
  }

  askQuestion(question) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new ConfigMigration();
  migration.migrate().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = ConfigMigration;