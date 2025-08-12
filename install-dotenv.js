#!/usr/bin/env node

/**
 * @fileoverview Install dotenv package for environment variable support
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('📦 Installing dotenv package for environment variable support...');

try {
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    console.error('❌ package.json not found. Please run this from the project root.');
    process.exit(1);
  }

  // Install dotenv
  console.log('Installing dotenv...');
  execSync('npm install dotenv@^16.3.1', { stdio: 'inherit' });
  
  console.log('✅ dotenv installed successfully!');
  console.log('');
  console.log('🔧 Next steps:');
  console.log('1. Run: npm run test-config');
  console.log('2. If successful, run: npm start');
  
} catch (error) {
  console.error('❌ Failed to install dotenv:', error.message);
  console.log('');
  console.log('🔧 Manual installation:');
  console.log('Run: npm install dotenv');
  process.exit(1);
}