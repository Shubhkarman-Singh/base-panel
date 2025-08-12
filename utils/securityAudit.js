/**
 * @fileoverview Security audit utilities for monitoring and preventing data exposure
 * Provides tools to audit configuration, detect sensitive data exposure, and monitor security events
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityAudit {
  constructor() {
    this.auditLog = [];
    this.sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /auth/i,
      /session/i,
      /cookie/i,
      /private/i,
      /confidential/i,
      /mysql:\/\/.*:.*@/i,  // MySQL connection strings with passwords
      /postgres:\/\/.*:.*@/i,  // PostgreSQL connection strings with passwords
      /mongodb:\/\/.*:.*@/i,   // MongoDB connection strings with passwords
      /[a-zA-Z0-9]{32,}/       // Long strings that might be secrets
    ];
  }

  /**
   * Audit configuration for security issues
   * @param {Object} config - Configuration object to audit
   * @returns {Object} Audit results
   */
  auditConfiguration(config) {
    const issues = [];
    const warnings = [];
    const recommendations = [];

    // Check for hardcoded secrets
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        // Check for database URLs with embedded credentials
        if (key.toLowerCase().includes('database') && value.includes('://')) {
          if (value.includes(':') && value.includes('@')) {
            issues.push({
              severity: 'HIGH',
              field: key,
              issue: 'Database URL contains embedded credentials',
              recommendation: 'Use environment variables for database credentials'
            });
          }
        }

        // Check for weak secrets
        if (key.toLowerCase().includes('secret')) {
          if (value.length < 32) {
            issues.push({
              severity: 'CRITICAL',
              field: key,
              issue: 'Secret is too short (less than 32 characters)',
              recommendation: 'Generate a cryptographically secure secret of at least 64 characters'
            });
          }
          
          if (value === 'secret' || value === 'your-secret-here' || value.includes('default')) {
            issues.push({
              severity: 'CRITICAL',
              field: key,
              issue: 'Using default or weak secret value',
              recommendation: 'Generate a unique, cryptographically secure secret'
            });
          }
        }

        // Check for development mode in production
        if (key === 'mode' && value === 'development') {
          warnings.push({
            severity: 'MEDIUM',
            field: key,
            issue: 'Running in development mode',
            recommendation: 'Set mode to "production" for production deployments'
          });
        }
      }
    }

    // Check for missing security configurations
    const requiredSecurityFields = ['session_secret'];
    requiredSecurityFields.forEach(field => {
      if (!config[field]) {
        issues.push({
          severity: 'CRITICAL',
          field: field,
          issue: 'Required security field is missing',
          recommendation: `Configure ${field} with a secure value`
        });
      }
    });

    // General recommendations
    recommendations.push({
      category: 'Environment Variables',
      recommendation: 'Use environment variables for all sensitive configuration values'
    });

    recommendations.push({
      category: 'Secret Rotation',
      recommendation: 'Implement regular rotation of secrets and API keys'
    });

    recommendations.push({
      category: 'Configuration Security',
      recommendation: 'Restrict file permissions on configuration files (chmod 600)'
    });

    return {
      issues,
      warnings,
      recommendations,
      score: this.calculateSecurityScore(issues, warnings),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate security score based on issues found
   * @param {Array} issues - Critical and high severity issues
   * @param {Array} warnings - Medium and low severity issues
   * @returns {number} Security score (0-100)
   */
  calculateSecurityScore(issues, warnings) {
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'CRITICAL':
          score -= 25;
          break;
        case 'HIGH':
          score -= 15;
          break;
        case 'MEDIUM':
          score -= 10;
          break;
        case 'LOW':
          score -= 5;
          break;
      }
    });

    warnings.forEach(warning => {
      score -= 5;
    });

    return Math.max(0, score);
  }

  /**
   * Scan code files for potential sensitive data exposure
   * @param {string} directory - Directory to scan
   * @returns {Array} Array of potential issues found
   */
  scanForSensitiveDataExposure(directory) {
    const issues = [];
    
    try {
      const files = this.getJavaScriptFiles(directory);
      
      files.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            // Check for console.log with sensitive data
            if (line.includes('console.log') || line.includes('console.error')) {
              this.sensitivePatterns.forEach(pattern => {
                if (pattern.test(line)) {
                  issues.push({
                    file: path.relative(directory, file),
                    line: index + 1,
                    issue: 'Potential sensitive data in console output',
                    code: line.trim(),
                    severity: 'MEDIUM'
                  });
                }
              });
            }

            // Check for hardcoded secrets
            if (line.includes('=') && !line.trim().startsWith('//')) {
              this.sensitivePatterns.forEach(pattern => {
                if (pattern.test(line) && !line.includes('process.env')) {
                  issues.push({
                    file: path.relative(directory, file),
                    line: index + 1,
                    issue: 'Potential hardcoded sensitive value',
                    code: line.trim(),
                    severity: 'HIGH'
                  });
                }
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
        }
      });
    } catch (error) {
      console.error('Error scanning for sensitive data:', error.message);
    }

    return issues;
  }

  /**
   * Get all JavaScript files in a directory recursively
   * @param {string} dir - Directory to scan
   * @returns {Array} Array of file paths
   */
  getJavaScriptFiles(dir) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.getJavaScriptFiles(fullPath));
        } else if (stat.isFile() && item.endsWith('.js')) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      // Skip directories that can't be read
    }
    
    return files;
  }

  /**
   * Generate security audit report
   * @param {string} projectRoot - Root directory of the project
   * @returns {Object} Complete audit report
   */
  generateAuditReport(projectRoot) {
    const configManager = require('./configManager');
    const config = configManager.loadConfig();
    
    const configAudit = this.auditConfiguration(config);
    const codeAudit = this.scanForSensitiveDataExposure(projectRoot);
    
    const report = {
      timestamp: new Date().toISOString(),
      projectRoot,
      configuration: configAudit,
      codeAnalysis: {
        issues: codeAudit,
        filesScanned: this.getJavaScriptFiles(projectRoot).length
      },
      summary: {
        totalIssues: configAudit.issues.length + codeAudit.filter(i => i.severity === 'HIGH' || i.severity === 'CRITICAL').length,
        totalWarnings: configAudit.warnings.length + codeAudit.filter(i => i.severity === 'MEDIUM' || i.severity === 'LOW').length,
        securityScore: configAudit.score,
        riskLevel: this.getRiskLevel(configAudit.score)
      },
      recommendations: [
        ...configAudit.recommendations,
        {
          category: 'Code Security',
          recommendation: 'Use secure logging utilities to prevent sensitive data exposure'
        },
        {
          category: 'Regular Audits',
          recommendation: 'Run security audits regularly and before deployments'
        }
      ]
    };

    return report;
  }

  /**
   * Get risk level based on security score
   * @param {number} score - Security score
   * @returns {string} Risk level
   */
  getRiskLevel(score) {
    if (score >= 90) return 'LOW';
    if (score >= 70) return 'MEDIUM';
    if (score >= 50) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Save audit report to file
   * @param {Object} report - Audit report
   * @param {string} filename - Output filename
   */
  saveAuditReport(report, filename = 'security-audit.json') {
    try {
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      console.log(`Security audit report saved to ${filename}`);
    } catch (error) {
      console.error('Error saving audit report:', error.message);
    }
  }

  /**
   * Log security event for monitoring
   * @param {string} event - Event type
   * @param {Object} details - Event details
   */
  logSecurityEvent(event, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details: this.sanitizeForLogging(details),
      severity: details.severity || 'INFO'
    };

    this.auditLog.push(logEntry);
    
    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }

    // Log to secure logger
    const log = require('./secureLogger');
    log.info(`Security Event: ${event}`, logEntry);
  }

  /**
   * Sanitize data for logging
   * @param {any} data - Data to sanitize
   * @returns {any} Sanitized data
   */
  sanitizeForLogging(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    Object.keys(sanitized).forEach(key => {
      if (this.sensitivePatterns.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Export singleton instance
module.exports = new SecurityAudit();