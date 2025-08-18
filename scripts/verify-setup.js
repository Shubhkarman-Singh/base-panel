#!/usr/bin/env node

/**
 * @fileoverview Setup verification script
 * Verifies that the environment-only configuration is working properly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Impulse Panel Setup Verification');
console.log('===================================');
console.log('');

let hasErrors = false;
let hasWarnings = false;

// Check 1: Verify no config.json exists
console.log('1. Checking for deprecated config.json...');
if (fs.existsSync('config.json')) {
  console.log('   ⚠️  config.json found - this file is no longer used');
  console.log('   → Consider removing it or keeping as backup only');
  hasWarnings = true;
} else {
  console.log('   ✅ No config.json found (good - using environment variables)');
}

// Check 2: Verify .env file exists
console.log('');
console.log('2. Checking for .env file...');
if (fs.existsSync('.env')) {
  console.log('   ✅ .env file found');
  
  // Check .env content
  const envContent = fs.readFileSync('.env', 'utf8');
  if (envContent.includes('SESSION_SECRET=')) {
    console.log('   ✅ SESSION_SECRET configured');
  } else {
    console.log('   ❌ SESSION_SECRET missing from .env');
    hasErrors = true;
  }
  
  if (envContent.includes('DATABASE_URL=')) {
    console.log('   ✅ DATABASE_URL configured');
  } else {
    console.log('   ❌ DATABASE_URL missing from .env');
    hasErrors = true;
  }
} else {
  console.log('   ❌ .env file not found');
  console.log('   → Run: cp .env.example .env');
  hasErrors = true;
}

// Check 3: Verify dotenv is installed
console.log('');
console.log('3. Checking for dotenv package...');
try {
  require('dotenv');
  console.log('   ✅ dotenv package is installed');
} catch (error) {
  console.log('   ❌ dotenv package not installed');
  console.log('   → Run: npm install dotenv');
  hasErrors = true;
}

// Check 4: Test configuration loading
console.log('');
console.log('4. Testing configuration loading...');
try {
  // Load environment variables
  require('dotenv').config();
  
  // Test ConfigManager
  const configManager = require('../utils/configManager');
  const config = configManager.loadConfig();
  
  console.log('   ✅ Configuration loaded successfully');
  
  // Test required fields
  const port = configManager.get('port');
  const sessionSecret = configManager.get('session_secret');
  
  if (port) {
    console.log(`   ✅ Port: ${port}`);
  } else {
    console.log('   ⚠️  Port not configured, using default');
    hasWarnings = true;
  }
  
  if (sessionSecret && sessionSecret.length >= 32) {
    console.log('   ✅ Session secret is secure');
  } else if (sessionSecret) {
    console.log('   ⚠️  Session secret is too short');
    hasWarnings = true;
  } else {
    console.log('   ❌ Session secret not configured');
    hasErrors = true;
  }
  
} catch (error) {
  console.log(`   ❌ Configuration test failed: ${error.message}`);
  hasErrors = true;
}

// Check 5: Verify migration cleanup
console.log('');
console.log('5. Checking migration cleanup...');
const migrationFiles = [
  'migrate-to-env.js',
  'utils/migrateSecurity.js'
];

let cleanupComplete = true;
migrationFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ⚠️  Migration file still exists: ${file}`);
    cleanupComplete = false;
    hasWarnings = true;
  }
});

if (cleanupComplete) {
  console.log('   ✅ Migration cleanup complete');
}

// Summary
console.log('');
console.log('📋 Summary');
console.log('==========');

if (hasErrors) {
  console.log('❌ Setup verification failed - please fix the errors above');
  console.log('');
  console.log('🔧 Quick fixes:');
  console.log('• Install dotenv: npm install dotenv');
  console.log('• Create .env: cp .env.example .env');
  console.log('• Generate secrets: npm run generate-secrets');
  console.log('• Test config: npm run test-config');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Setup verification passed with warnings');
  console.log('   Your application should work, but consider addressing the warnings above');
} else {
  console.log('✅ Setup verification passed!');
  console.log('   Your Impulse Panel is properly configured with environment variables');
}

console.log('');
console.log('🚀 Next steps:');
console.log('• Run: npm run test-config (to verify configuration)');
console.log('• Run: npm run create-user (to create admin user)');
console.log('• Run: npm start (to start the application)');