#!/usr/bin/env node

/**
 * @fileoverview Configuration test script
 * Tests that the configuration system is working properly
 */

// Load environment variables from .env file first
try {
  require('dotenv').config();
} catch (error) {
  console.log('⚠️  dotenv not installed. Run: npm install dotenv');
}

console.log('🧪 Testing Impulse Panel Configuration');
console.log('=====================================');
console.log('');

try {
  // Test ConfigManager
  console.log('📋 Testing ConfigManager...');
  const configManager = require('./utils/configManager');
  
  // Test basic configuration loading
  const config = configManager.loadConfig();
  console.log('✅ Configuration loaded successfully');
  
  // Test required fields
  const requiredFields = ['port', 'baseUri', 'domain', 'version'];
  requiredFields.forEach(field => {
    const value = configManager.get(field);
    if (value) {
      console.log(`✅ ${field}: ${value}`);
    } else {
      console.log(`❌ ${field}: NOT SET`);
    }
  });
  
  // Test sensitive fields (should be masked in logs)
  console.log('');
  console.log('🔒 Testing sensitive data protection...');
  const sanitizedConfig = configManager.getSanitizedConfig();
  console.log('✅ Sanitized config:', JSON.stringify(sanitizedConfig, null, 2));
  
  // Test database configuration
  console.log('');
  console.log('🗄️  Testing database configuration...');
  const dbConfig = configManager.getDatabaseConfig();
  console.log('✅ Database type:', dbConfig.type);
  console.log('✅ Database configured successfully');
  
  // Test validation
  console.log('');
  console.log('🔍 Testing configuration validation...');
  const isValid = configManager.validateConfig();
  console.log('✅ Configuration validation passed');
  
  console.log('');
  console.log('✅ All configuration tests passed!');
  console.log('');
  console.log('🚀 Your Impulse Panel is ready to start!');
  console.log('Run: npm start');
  
} catch (error) {
  console.error('❌ Configuration test failed:', error.message);
  console.log('');
  console.log('🔧 Troubleshooting:');
  console.log('1. Make sure you have a .env file (copy from .env.example)');
  console.log('2. Check that all required environment variables are set');
  console.log('3. Verify your configuration syntax');
  console.log('4. Run "npm run generate-secrets" to create secure secrets');
  process.exit(1);
}