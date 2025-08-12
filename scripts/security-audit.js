#!/usr/bin/env node

/**
 * @fileoverview Security audit script
 * Runs a comprehensive security audit of the Impulse Panel installation
 */

const path = require('path');
const SecurityAudit = require('../utils/securityAudit');

console.log('🔒 Impulse Panel Security Audit');
console.log('================================\n');

try {
  // Generate comprehensive audit report
  const projectRoot = path.join(__dirname, '..');
  const report = SecurityAudit.generateAuditReport(projectRoot);

  // Display summary
  console.log('📊 Security Audit Summary:');
  console.log(`Security Score: ${report.summary.securityScore}/100`);
  console.log(`Risk Level: ${report.summary.riskLevel}`);
  console.log(`Total Issues: ${report.summary.totalIssues}`);
  console.log(`Total Warnings: ${report.summary.totalWarnings}`);
  console.log(`Files Scanned: ${report.codeAnalysis.filesScanned}`);
  console.log();

  // Display critical issues
  if (report.configuration.issues.length > 0) {
    console.log('🚨 Configuration Issues:');
    report.configuration.issues.forEach(issue => {
      console.log(`  [${issue.severity}] ${issue.field}: ${issue.issue}`);
      console.log(`    → ${issue.recommendation}`);
    });
    console.log();
  }

  // Display code issues
  const criticalCodeIssues = report.codeAnalysis.issues.filter(i => 
    i.severity === 'CRITICAL' || i.severity === 'HIGH'
  );
  
  if (criticalCodeIssues.length > 0) {
    console.log('🚨 Critical Code Issues:');
    criticalCodeIssues.forEach(issue => {
      console.log(`  [${issue.severity}] ${issue.file}:${issue.line}`);
      console.log(`    ${issue.issue}`);
      console.log(`    Code: ${issue.code}`);
    });
    console.log();
  }

  // Display recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Security Recommendations:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec.category}: ${rec.recommendation}`);
    });
    console.log();
  }

  // Save detailed report
  const reportFile = `security-audit-${new Date().toISOString().split('T')[0]}.json`;
  SecurityAudit.saveAuditReport(report, reportFile);
  console.log(`📄 Detailed report saved to ${reportFile}`);

  // Exit with appropriate code
  if (report.summary.totalIssues > 0) {
    console.log('\n⚠️  Security issues found. Please review and address them.');
    process.exit(1);
  } else {
    console.log('\n✅ No critical security issues found!');
    process.exit(0);
  }

} catch (error) {
  console.error('❌ Security audit failed:', error.message);
  process.exit(1);
}