#!/usr/bin/env node

/**
 * Security Audit Script for Impulse Panel
 * Performs automated security checks and reports vulnerabilities
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.info = [];
  }

  log(level, message, details = null) {
    const entry = { level, message, details, timestamp: new Date().toISOString() };
    
    switch (level) {
      case 'error':
        this.issues.push(entry);
        console.log(`❌ ${message}`);
        break;
      case 'warning':
        this.warnings.push(entry);
        console.log(`⚠️  ${message}`);
        break;
      case 'info':
        this.info.push(entry);
        console.log(`ℹ️  ${message}`);
        break;
      case 'success':
        console.log(`✅ ${message}`);
        break;
    }
    
    if (details) {
      console.log(`   ${details}`);
    }
  }

  checkFilePermissions() {
    console.log('\n🔒 Checking File Permissions...');
    
    const sensitiveFiles = [
      '.env',
      'impulse.db',
      'sessions.db',
      'storage/theme.json'
    ];

    sensitiveFiles.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          const stats = fs.statSync(file);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (mode !== '600' && mode !== '644') {
            this.log('warning', `File ${file} has permissive permissions: ${mode}`, 
              'Consider setting permissions to 600 for sensitive files');
          } else {
            this.log('success', `File ${file} has secure permissions: ${mode}`);
          }
        } catch (error) {
          this.log('error', `Cannot check permissions for ${file}`, error.message);
        }
      }
    });
  }

  checkEnvironmentVariables() {
    console.log('\n🔐 Checking Environment Configuration...');
    
    const requiredEnvVars = [
      'SESSION_SECRET',
      'DATABASE_URL'
    ];

    const recommendedEnvVars = [
      'NODE_ENV',
      'PORT',
      'BASE_URI',
      'DOMAIN',
      'SALT_ROUNDS'
    ];

    const optionalSecurityVars = [
      'API_SECRET',
      'ENCRYPTION_KEY',
      'JWT_SECRET'
    ];

    const productionVars = [
      'SMTP_HOST',
      'SMTP_PORT', 
      'SMTP_USER',
      'SMTP_PASSWORD'
    ];

    // Check required variables
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.log('error', `Missing required environment variable: ${envVar}`,
          'This could lead to security vulnerabilities or application failure');
      } else {
        this.log('success', `Environment variable ${envVar} is set`);
      }
    });

    // Check recommended variables
    recommendedEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.log('warning', `Missing recommended environment variable: ${envVar}`,
          'Application will use defaults but may not be optimal for production');
      } else {
        this.log('success', `Environment variable ${envVar} is set`);
      }
    });

    // Check security-related variables
    optionalSecurityVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.log('info', `Optional security variable ${envVar} not set`,
          'Consider setting for enhanced security features');
      } else {
        this.log('success', `Security variable ${envVar} is configured`);
      }
    });

    // Check production variables
    if (process.env.NODE_ENV === 'production') {
      productionVars.forEach(envVar => {
        if (!process.env[envVar]) {
          this.log('warning', `Production variable ${envVar} not set`,
            'Email functionality may not work in production');
        }
      });
    }

    // Validate session secret strength
    if (process.env.SESSION_SECRET) {
      if (process.env.SESSION_SECRET.length < 32) {
        this.log('error', 'SESSION_SECRET is too short (< 32 characters)', 
          'Use at least 32 characters for session secrets');
      } else if (process.env.SESSION_SECRET.length < 64) {
        this.log('warning', 'SESSION_SECRET could be longer (< 64 characters)',
          'Consider using 64+ characters for maximum security');
      } else {
        this.log('success', 'SESSION_SECRET has adequate length');
      }

      // Check for weak patterns
      if (/^(.)\1+$/.test(process.env.SESSION_SECRET)) {
        this.log('error', 'SESSION_SECRET uses repeated characters',
          'Generate a cryptographically secure random secret');
      } else if (process.env.SESSION_SECRET.includes('your_secure') || 
                 process.env.SESSION_SECRET.includes('change_me') ||
                 process.env.SESSION_SECRET.includes('example')) {
        this.log('error', 'SESSION_SECRET appears to be a placeholder',
          'Generate a real cryptographically secure secret');
      }
    }

    // Check database URL format
    if (process.env.DATABASE_URL) {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl.startsWith('sqlite://')) {
        this.log('success', 'Using SQLite database');
        const dbFile = dbUrl.replace('sqlite://', '') || 'impulse.db';
        if (fs.existsSync(dbFile)) {
          this.log('success', `Database file ${dbFile} exists`);
        } else {
          this.log('info', `Database file ${dbFile} will be created on first run`);
        }
      } else if (dbUrl.startsWith('mysql://') || dbUrl.startsWith('postgresql://')) {
        this.log('success', 'Using external database (recommended for production)');
        
        // Check for password in URL (security concern)
        if (dbUrl.includes('@') && dbUrl.includes(':') && !dbUrl.includes('localhost')) {
          this.log('warning', 'Database credentials in URL for remote database',
            'Ensure connection is encrypted and credentials are secure');
        }
      } else {
        this.log('error', 'Invalid DATABASE_URL format',
          'Must start with sqlite://, mysql://, or postgresql://');
      }
    }

    // Check NODE_ENV setting
    if (process.env.NODE_ENV === 'production') {
      this.log('success', 'Running in production mode');
      
      // Production-specific checks
      if (process.env.BASE_URI && !process.env.BASE_URI.startsWith('https://')) {
        this.log('error', 'BASE_URI should use HTTPS in production',
          'HTTP connections are not secure for production use');
      }
    } else if (process.env.NODE_ENV === 'development') {
      this.log('info', 'Running in development mode');
    } else {
      this.log('warning', 'NODE_ENV not set or invalid',
        'Should be either "production" or "development"');
    }

    // Check for .env file existence
    if (fs.existsSync('.env')) {
      this.log('success', '.env file found');
      
      // Check .env file permissions
      try {
        const stats = fs.statSync('.env');
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        
        if (mode === '600') {
          this.log('success', '.env file has secure permissions (600)');
        } else if (mode === '644') {
          this.log('warning', '.env file is readable by group/others (644)',
            'Consider setting permissions to 600 for better security');
        } else {
          this.log('error', `.env file has insecure permissions (${mode})`,
            'Set permissions to 600: chmod 600 .env');
        }
      } catch (error) {
        this.log('warning', 'Cannot check .env file permissions');
      }
    } else {
      this.log('error', '.env file not found',
        'Copy .env.example to .env and configure your settings');
    }
  }

  checkDependencyVulnerabilities() {
    console.log('\n📦 Checking Dependencies for Vulnerabilities...');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
        const vulnCount = Object.keys(audit.vulnerabilities).length;
        this.log('error', `Found ${vulnCount} dependency vulnerabilities`,
          'Run "npm audit fix" to resolve automatically fixable issues');
        
        // Log high/critical vulnerabilities
        Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            this.log('error', `${vuln.severity.toUpperCase()} vulnerability in ${pkg}`,
              vuln.title);
          }
        });
      } else {
        this.log('success', 'No known dependency vulnerabilities found');
      }
    } catch (error) {
      this.log('warning', 'Could not run dependency audit', 
        'Run "npm audit" manually to check for vulnerabilities');
    }
  }

  checkSecurityHeaders() {
    console.log('\n🛡️  Checking Security Headers Configuration...');
    
    const indexPath = path.join(process.cwd(), 'index.js');
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      
      const securityChecks = [
        { pattern: /helmet/i, name: 'Helmet middleware' },
        { pattern: /contentSecurityPolicy/i, name: 'Content Security Policy' },
        { pattern: /hsts/i, name: 'HTTP Strict Transport Security' },
        { pattern: /frameguard/i, name: 'X-Frame-Options' },
        { pattern: /noSniff/i, name: 'X-Content-Type-Options' }
      ];

      securityChecks.forEach(check => {
        if (check.pattern.test(content)) {
          this.log('success', `${check.name} is configured`);
        } else {
          this.log('warning', `${check.name} is not configured`,
            'Consider adding security headers for better protection');
        }
      });
    }
  }

  checkEmailSecurity() {
    console.log('\n📧 Checking Email Security Configuration...');
    
    const emailPath = path.join(process.cwd(), 'handlers', 'email.js');
    
    if (fs.existsSync(emailPath)) {
      const content = fs.readFileSync(emailPath, 'utf8');
      
      if (content.includes('rejectUnauthorized: false')) {
        this.log('error', 'Email TLS verification is disabled',
          'This allows man-in-the-middle attacks on email communications');
      } else if (content.includes('rejectUnauthorized: true')) {
        this.log('success', 'Email TLS verification is enabled');
      }

      if (content.includes('minVersion')) {
        this.log('success', 'Minimum TLS version is configured');
      } else {
        this.log('warning', 'No minimum TLS version specified for email',
          'Consider setting minVersion to TLSv1.2 or higher');
      }
    }
  }

  checkFileUploadSecurity() {
    console.log('\n📁 Checking File Upload Security...');
    
    const settingsPath = path.join(process.cwd(), 'routes', 'Admin', 'Settings.js');
    
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf8');
      
      if (content.includes('fileFilter')) {
        this.log('success', 'File type filtering is implemented');
      } else {
        this.log('error', 'No file type filtering found',
          'This allows upload of potentially malicious files');
      }

      if (content.includes('limits')) {
        this.log('success', 'File size limits are configured');
      } else {
        this.log('warning', 'No file size limits configured',
          'This could lead to storage exhaustion attacks');
      }

      if (content.includes('public') && content.includes('destination')) {
        this.log('warning', 'Files may be uploaded directly to public directory',
          'Consider using a secure upload directory with validation');
      }
    }
  }

  checkDatabaseSecurity() {
    console.log('\n🗄️  Checking Database Security...');
    
    const dbFiles = ['impulse.db', 'sessions.db'];
    
    dbFiles.forEach(dbFile => {
      if (fs.existsSync(dbFile)) {
        try {
          const stats = fs.statSync(dbFile);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (mode === '644' || mode === '600') {
            this.log('success', `Database ${dbFile} has secure permissions (${mode})`);
          } else {
            this.log('error', `Database ${dbFile} has insecure permissions: ${mode}`,
              'Database files should not be world-readable (use 600 or 644)');
          }

          // Check file size for potential issues
          const sizeInMB = stats.size / (1024 * 1024);
          if (sizeInMB > 100) {
            this.log('warning', `Database ${dbFile} is large (${sizeInMB.toFixed(1)}MB)`,
              'Consider database maintenance or cleanup');
          }
        } catch (error) {
          this.log('error', `Cannot check database permissions for ${dbFile}`, error.message);
        }
      } else {
        this.log('info', `Database ${dbFile} not found (will be created on first run)`);
      }
    });

    // Check for backup files that might contain sensitive data
    const backupPatterns = ['*.bak', '*.backup', '*.sql', '*.dump'];
    backupPatterns.forEach(pattern => {
      try {
        const files = fs.readdirSync('.').filter(file => 
          file.match(new RegExp(pattern.replace('*', '.*')))
        );
        if (files.length > 0) {
          this.log('warning', `Found potential backup files: ${files.join(', ')}`,
            'Ensure backup files are properly secured and not in public directories');
        }
      } catch (error) {
        // Ignore errors when checking for backup files
      }
    });
  }

  checkConfigurationFiles() {
    console.log('\n⚙️  Checking Configuration Files...');
    
    // Check for old config.json files
    if (fs.existsSync('config.json')) {
      this.log('warning', 'Legacy config.json file found',
        'This file is no longer used. Consider removing it or keeping as backup only');
    } else {
      this.log('success', 'No legacy config.json found (good - using environment variables)');
    }

    // Check for .env.example
    if (fs.existsSync('.env.example')) {
      this.log('success', '.env.example template file exists');
    } else {
      this.log('warning', '.env.example template file missing',
        'Users need this file to set up their environment');
    }

    // Check for sensitive files in public directories
    const publicDirs = ['public', 'static', 'assets'];
    const sensitiveFiles = ['.env', 'config.json', '*.db', '*.key', '*.pem'];
    
    publicDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir, { recursive: true });
          sensitiveFiles.forEach(pattern => {
            const matches = files.filter(file => 
              file.match(new RegExp(pattern.replace('*', '.*')))
            );
            if (matches.length > 0) {
              this.log('error', `Sensitive files found in public directory ${dir}: ${matches.join(', ')}`,
                'Move sensitive files outside public directories');
            }
          });
        } catch (error) {
          // Ignore errors when checking public directories
        }
      }
    });
  }

  checkLogSecurity() {
    console.log('\n📝 Checking Log Security...');
    
    const logDirs = ['logs', 'log', 'var/log'];
    const logFiles = ['error.log', 'access.log', 'app.log', 'debug.log'];
    
    let foundLogs = false;
    
    logDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        foundLogs = true;
        try {
          const stats = fs.statSync(dir);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (mode === '755' || mode === '750') {
            this.log('success', `Log directory ${dir} has appropriate permissions (${mode})`);
          } else {
            this.log('warning', `Log directory ${dir} has permissions: ${mode}`,
              'Consider setting log directory permissions to 750 or 755');
          }
        } catch (error) {
          this.log('warning', `Cannot check permissions for log directory ${dir}`);
        }
      }
    });

    // Check for log files in root directory
    logFiles.forEach(logFile => {
      if (fs.existsSync(logFile)) {
        foundLogs = true;
        try {
          const stats = fs.statSync(logFile);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (mode === '644' || mode === '640') {
            this.log('success', `Log file ${logFile} has secure permissions (${mode})`);
          } else {
            this.log('warning', `Log file ${logFile} has permissions: ${mode}`,
              'Consider setting log file permissions to 644 or 640');
          }

          // Check log file size
          const sizeInMB = stats.size / (1024 * 1024);
          if (sizeInMB > 50) {
            this.log('warning', `Log file ${logFile} is large (${sizeInMB.toFixed(1)}MB)`,
              'Consider implementing log rotation');
          }
        } catch (error) {
          this.log('warning', `Cannot check permissions for log file ${logFile}`);
        }
      }
    });

    if (!foundLogs) {
      this.log('info', 'No log files or directories found',
        'Consider implementing proper logging for production deployments');
    }
  }

  generateReport() {
    console.log('\n📊 Security Audit Summary');
    console.log('='.repeat(50));
    
    console.log(`\n🔴 Critical Issues: ${this.issues.length}`);
    console.log(`🟡 Warnings: ${this.warnings.length}`);
    console.log(`ℹ️  Information: ${this.info.length}`);
    
    if (this.issues.length > 0) {
      console.log('\n🔴 Critical Issues to Address:');
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.message}`);
        if (issue.details) {
          console.log(`   ${issue.details}`);
        }
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n🟡 Warnings to Consider:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.message}`);
        if (warning.details) {
          console.log(`   ${warning.details}`);
        }
      });
    }

    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        critical: this.issues.length,
        warnings: this.warnings.length,
        info: this.info.length
      },
      issues: this.issues,
      warnings: this.warnings,
      info: this.info
    };

    fs.writeFileSync('security-audit-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: security-audit-report.json');
    
    return this.issues.length === 0;
  }

  async run() {
    console.log('🔍 Starting Security Audit for Impulse Panel');
    console.log('='.repeat(50));
    
    // Load environment variables for testing
    try {
      require('dotenv').config();
    } catch (error) {
      this.log('warning', 'dotenv not available, using system environment variables only');
    }
    
    this.checkEnvironmentVariables();
    this.checkConfigurationFiles();
    this.checkFilePermissions();
    this.checkSecurityHeaders();
    this.checkEmailSecurity();
    this.checkFileUploadSecurity();
    this.checkDatabaseSecurity();
    this.checkLogSecurity();
    this.checkDependencyVulnerabilities();
    
    const passed = this.generateReport();
    
    if (passed) {
      console.log('\n✅ Security audit completed successfully!');
      console.log('\n🔒 Security recommendations:');
      console.log('• Regularly update dependencies (npm audit && npm update)');
      console.log('• Rotate secrets quarterly');
      console.log('• Monitor logs for suspicious activity');
      console.log('• Keep backups secure and encrypted');
      console.log('• Use HTTPS in production');
      process.exit(0);
    } else {
      console.log('\n❌ Security audit found critical issues that need attention.');
      console.log('\n🔧 Quick fixes:');
      console.log('• Run: npm run generate-secrets (to create secure secrets)');
      console.log('• Run: chmod 600 .env (to secure environment file)');
      console.log('• Run: npm audit fix (to fix dependency vulnerabilities)');
      console.log('• Review and address all critical issues above');
      process.exit(1);
    }
  }
}

// Run audit if called directly
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.run().catch(error => {
    console.error('❌ Security audit failed:', error.message);
    process.exit(1);
  });
}

module.exports = SecurityAuditor;