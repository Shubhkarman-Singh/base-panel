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
      'SALT_ROUNDS'
    ];

    const recommendedEnvVars = [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL'
    ];

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.log('error', `Missing required environment variable: ${envVar}`,
          'This could lead to security vulnerabilities');
      } else {
        this.log('success', `Environment variable ${envVar} is set`);
      }
    });

    recommendedEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        this.log('warning', `Missing recommended environment variable: ${envVar}`);
      } else {
        this.log('success', `Environment variable ${envVar} is set`);
      }
    });

    // Check for weak session secret
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
      this.log('error', 'SESSION_SECRET is too short', 
        'Use at least 32 characters for session secrets');
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
            this.log('success', `Database ${dbFile} has secure permissions`);
          } else {
            this.log('error', `Database ${dbFile} has insecure permissions: ${mode}`,
              'Database files should not be world-readable');
          }
        } catch (error) {
          this.log('error', `Cannot check database permissions for ${dbFile}`);
        }
      }
    });
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
    
    this.checkEnvironmentVariables();
    this.checkFilePermissions();
    this.checkSecurityHeaders();
    this.checkEmailSecurity();
    this.checkFileUploadSecurity();
    this.checkDatabaseSecurity();
    this.checkDependencyVulnerabilities();
    
    const passed = this.generateReport();
    
    if (passed) {
      console.log('\n✅ Security audit completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Security audit found critical issues that need attention.');
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