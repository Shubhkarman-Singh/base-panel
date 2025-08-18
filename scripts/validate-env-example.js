#!/usr/bin/env node

/**
 * @fileoverview Validates that .env.example contains all environment variables used in the codebase
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating .env.example completeness');
console.log('=====================================');

// Load the configManager to see what variables it expects
const configManager = require('../utils/configManager');

// Get all environment variables used in configManager
const envVarsUsed = [
  'DATABASE_URL',
  'DATABASE_TABLE', 
  'SESSION_SECRET',
  'PORT',
  'BASE_URI',
  'DOMAIN',
  'NODE_ENV',
  'VERSION',
  'VERSION_STATE',
  'SALT_ROUNDS',
  'OG_TITLE',
  'OG_DESCRIPTION',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'API_SECRET',
  'ENCRYPTION_KEY'
];

// Read .env.example file
if (!fs.existsSync('.env.example')) {
  console.log('❌ .env.example file not found');
  process.exit(1);
}

const envExampleContent = fs.readFileSync('.env.example', 'utf8');

// Check if all used variables are documented in .env.example
let missing = [];
let found = [];

envVarsUsed.forEach(envVar => {
  if (envExampleContent.includes(`${envVar}=`) || envExampleContent.includes(`# ${envVar}=`)) {
    found.push(envVar);
    console.log(`✅ ${envVar} - documented`);
  } else {
    missing.push(envVar);
    console.log(`❌ ${envVar} - missing from .env.example`);
  }
});

console.log('\n📊 Summary');
console.log('==========');
console.log(`✅ Documented: ${found.length}`);
console.log(`❌ Missing: ${missing.length}`);

if (missing.length > 0) {
  console.log('\n🔧 Missing variables that should be added to .env.example:');
  missing.forEach(envVar => {
    console.log(`• ${envVar}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All environment variables are documented in .env.example');
  process.exit(0);
}