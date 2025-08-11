const fs = require('fs');
const crypto = require('crypto');

// Read current config
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Generate new secure session secret
config.session_secret = crypto.randomBytes(64).toString('hex');

// Write back to config
fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

console.log('✅ Generated new secure session secret!');
console.log('New session secret length:', config.session_secret.length);