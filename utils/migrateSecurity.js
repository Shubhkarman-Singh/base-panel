#!/usr/bin/env node

/**
 * @fileoverview Security migration utility
 * Helps migrate from insecure configuration to secure environment-based configuration
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class SecurityMigration {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.envPath = path.join(process.cwd(), '.env');
    this.envExamplePath = path.join(process.cwd(), '.env.example');
  }

  /**
   * Run the security migration
   */
  async migrate() {
    console.log('🔒 Impulse Panel Security Migration Tool');
    console.log('=========================================\n');

    try {
      // Step 1: Backup current config
      await this.backupConfig();

      // Step 2: Analyze current configuration
      const analysis = await this.analyzeConfig();
      this.displayAnalysis(analysis);

      // Step 3: Generate secure .env file
      await this.generateEnvFile(analysis);

      // Step 4: Update config.json to remove sensitive data
      await this.updateConfig(analysis);

      // Step 5: Run security audit
      await this.runSecurityAudit();

      console.log('\n✅ Security migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Review the generated .env file');
      console.log('2. Update any remaining sensitive values');
      console.log('3. Add .env to your .gitignore file');
      console.log('4. Restart your application');
      console.log('5. Run security audit regularly');

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Backup current configuration
   */
  async backupConfig() {
    if (fs.existsSync(this.configPath)) {
      const backupPath = `${this.configPath}.backup.${Date.now()}`;
      fs.copyFileSync(this.configPath, backupPath);
      console.log(`📋 Backed up config.json to ${path.basename(backupPath)}`);
    }
  }

  /**
   * Analyze current configuration for security issues
   */
  async analyzeConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error('config.json not found');
    }

    const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    const analysis = {
      sensitiveFields: [],
      weakSecrets: [],
      recommendations: [],
      config: config
    };

    // Check for sensitive fields
    const sensitiveFieldNames = [
      'session_secret',
      'databaseURL',
      'smtp_password',
      'api_secret',
      'encryption_key'
    ];

    sensitiveFieldNames.forEach(field => {
      if (config[field]) {
        analysis.sensitiveFields.push({
          field,
          value: config[field],
          shouldMoveToEnv: true
        });
      }
    });

    // Check for weak secrets
    if (config.session_secret) {
      if (config.session_secret.length < 32) {
        analysis.weakSecrets.push({
          field: 'session_secret',
          issue: 'Too short (less than 32 characters)',
          action: 'Generate new secure secret'
        });
      }
      if (config.session_secret === 'secret' || config.session_secret.includes('default')) {
        analysis.weakSecrets.push({
          field: 'session_secret',
          issue: 'Using default or weak value',
          action: 'Generate new secure secret'
        });
      }
    }

    // Check database URL
    if (config.databaseURL && config.databaseURL.includes('://') && config.databaseURL.includes('@')) {
      analysis.recommendations.push({
        type: 'DATABASE_CREDENTIALS',
        message: 'Database URL contains embedded credentials - should be moved to environment variables'
      });
    }

    // Check development mode
    if (config.mode === 'development') {
      analysis.recommendations.push({
        type: 'DEVELOPMENT_MODE',
        message: 'Running in development mode - consider setting to production'
      });
    }

    return analysis;
  }

  /**
   * Display analysis results
   */
  displayAnalysis(analysis) {
    console.log('🔍 Configuration Analysis Results:');
    console.log('==================================\n');

    if (analysis.sensitiveFields.length > 0) {
      console.log('📋 Sensitive fields found:');
      analysis.sensitiveFields.forEach(field => {
        console.log(`  - ${field.field}: ${this.maskValue(field.value)}`);
      });
      console.log();
    }

    if (analysis.weakSecrets.length > 0) {
      console.log('⚠️  Weak secrets detected:');
      analysis.weakSecrets.forEach(secret => {
        console.log(`  - ${secret.field}: ${secret.issue}`);
      });
      console.log();
    }

    if (analysis.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      analysis.recommendations.forEach(rec => {
        console.log(`  - ${rec.message}`);
      });
      console.log();
    }
  }

  /**
   * Generate secure .env file
   */
  async generateEnvFile(analysis) {
    let envContent = `# Impulse Panel Environment Configuration
# Generated by Security Migration Tool on ${new Date().toISOString()}
# DO NOT commit this file to version control

# ==============================================
# CRITICAL SECURITY SETTINGS
# ==============================================

`;

    // Generate new session secret if needed
    const needsNewSessionSecret = analysis.weakSecrets.some(s => s.field === 'session_secret');
    const sessionSecret = needsNewSessionSecret ? 
      crypto.randomBytes(64).toString('hex') : 
      analysis.config.session_secret;

    envContent += `# Session Security
SESSION_SECRET=${sessionSecret}

`;

    // Add database URL
    if (analysis.config.databaseURL) {
      envContent += `# Database Configuration
DATABASE_URL=${analysis.config.databaseURL}

`;
    }

    // Add server configuration
    envContent += `# Server Configuration
PORT=${analysis.config.port || 3000}
BASE_URI=${analysis.config.baseUri || 'http://localhost:3000'}
DOMAIN=${analysis.config.domain || 'localhost'}
NODE_ENV=production

`;

    // Add email configuration if present
    if (analysis.config.smtp_host || analysis.config.smtp_user) {
      envContent += `# Email Configuration
`;
      if (analysis.config.smtp_host) envContent += `SMTP_HOST=${analysis.config.smtp_host}\n`;
      if (analysis.config.smtp_port) envContent += `SMTP_PORT=${analysis.config.smtp_port}\n`;
      if (analysis.config.smtp_user) envContent += `SMTP_USER=${analysis.config.smtp_user}\n`;
      if (analysis.config.smtp_password) envContent += `SMTP_PASSWORD=${analysis.config.smtp_password}\n`;
      envContent += '\n';
    }

    // Add additional security fields
    envContent += `# Additional Security (Optional)
`;
    if (analysis.config.api_secret) {
      envContent += `API_SECRET=${analysis.config.api_secret}\n`;
    } else {
      envContent += `# API_SECRET=${crypto.randomBytes(32).toString('hex')}\n`;
    }

    if (analysis.config.encryption_key) {
      envContent += `ENCRYPTION_KEY=${analysis.config.encryption_key}\n`;
    } else {
      envContent += `# ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}\n`;
    }

    // Write .env file
    fs.writeFileSync(this.envPath, envContent);
    console.log('📝 Generated secure .env file');

    // Update .env.example if it doesn't exist
    if (!fs.existsSync(this.envExamplePath)) {
      const exampleContent = envContent
        .replace(/^([A-Z_]+=).+$/gm, '$1your_secure_value_here')
        .replace(/^# ([A-Z_]+=).+$/gm, '# $1your_secure_value_here');
      
      fs.writeFileSync(this.envExamplePath, exampleContent);
      console.log('📝 Generated .env.example template');
    }
  }

  /**
   * Update config.json to remove sensitive data
   */
  async updateConfig(analysis) {
    const config = { ...analysis.config };
    
    // Remove sensitive fields that are now in .env
    const fieldsToRemove = ['session_secret', 'databaseURL', 'smtp_password', 'api_secret', 'encryption_key'];
    fieldsToRemove.forEach(field => {
      if (config[field]) {
        delete config[field];
      }
    });

    // Set mode to production if it was development
    if (config.mode === 'development') {
      config.mode = 'production';
    }

    // Write updated config
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    console.log('📝 Updated config.json (removed sensitive data)');
  }

  /**
   * Run security audit
   */
  async runSecurityAudit() {
    try {
      const SecurityAudit = require('./securityAudit');
      const report = SecurityAudit.generateAuditReport(process.cwd());
      
      console.log('\n🔍 Security Audit Results:');
      console.log(`Security Score: ${report.summary.securityScore}/100`);
      console.log(`Risk Level: ${report.summary.riskLevel}`);
      console.log(`Issues Found: ${report.summary.totalIssues}`);
      console.log(`Warnings: ${report.summary.totalWarnings}`);

      // Save detailed report
      SecurityAudit.saveAuditReport(report, 'security-audit-post-migration.json');
      console.log('📊 Detailed audit report saved to security-audit-post-migration.json');

    } catch (error) {
      console.log('⚠️  Could not run security audit:', error.message);
    }
  }

  /**
   * Mask sensitive values for display
   */
  maskValue(value) {
    if (!value || typeof value !== 'string') return '[EMPTY]';
    if (value.length <= 8) return '*'.repeat(value.length);
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4);
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new SecurityMigration();
  migration.migrate().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityMigration;