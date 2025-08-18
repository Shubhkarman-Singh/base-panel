#!/usr/bin/env node

/**
 * Security Migration Script
 * Applies security fixes to existing Impulse Panel installations
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityMigration {
  constructor() {
    this.changes = [];
    this.errors = [];
  }

  log(message, isError = false) {
    if (isError) {
      this.errors.push(message);
      console.log(`❌ ${message}`);
    } else {
      this.changes.push(message);
      console.log(`✅ ${message}`);
    }
  }

  async createSecureDirectories() {
    console.log('\n📁 Creating secure directories...');
    
    const directories = [
      'storage/uploads',
      'storage/backups',
      'logs'
    ];

    directories.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
          this.log(`Created directory: ${dir}`);
        } else {
          this.log(`Directory already exists: ${dir}`);
        }
      } catch (error) {
        this.log(`Failed to create directory ${dir}: ${error.message}`, true);
      }
    });
  }

  async updateFilePermissions() {
    console.log('\n🔒 Updating file permissions...');
    
    const sensitiveFiles = [
      { file: '.env', mode: 0o600 },
      { file: 'impulse.db', mode: 0o600 },
      { file: 'sessions.db', mode: 0o600 }
    ];

    sensitiveFiles.forEach(({ file, mode }) => {
      try {
        if (fs.existsSync(file)) {
          fs.chmodSync(file, mode);
          this.log(`Updated permissions for ${file}`);
        }
      } catch (error) {
        this.log(`Failed to update permissions for ${file}: ${error.message}`, true);
      }
    });
  }

  async checkEnvironmentVariables() {
    console.log('\n🔐 Checking environment variables...');
    
    const requiredVars = [
      'SESSION_SECRET',
      'SALT_ROUNDS'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      this.log(`Missing environment variables: ${missing.join(', ')}`, true);
      console.log('\n💡 To fix this:');
      console.log('1. Copy .env.example to .env if you haven\'t already');
      console.log('2. Run: npm run generate-secrets');
      console.log('3. Restart the application');
    } else {
      this.log('All required environment variables are set');
    }
  }

  async updatePackageJson() {
    console.log('\n📦 Checking package.json dependencies...');
    
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredDeps = {
        'helmet': '^7.1.0'
      };

      let needsUpdate = false;
      
      for (const [dep, version] of Object.entries(requiredDeps)) {
        if (!packageJson.dependencies[dep]) {
          packageJson.dependencies[dep] = version;
          needsUpdate = true;
          this.log(`Added dependency: ${dep}@${version}`);
        }
      }

      if (needsUpdate) {
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        this.log('Updated package.json with security dependencies');
        console.log('\n💡 Run "npm install" to install new dependencies');
      } else {
        this.log('All required dependencies are present');
      }
    } catch (error) {
      this.log(`Failed to update package.json: ${error.message}`, true);
    }
  }

  async createGitignoreEntries() {
    console.log('\n📝 Updating .gitignore...');
    
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const requiredEntries = [
      '# Security files',
      '.env',
      '*.db',
      'security-audit-report.json',
      'storage/uploads/*',
      '!storage/uploads/.gitkeep',
      'logs/*',
      '!logs/.gitkeep'
    ];

    try {
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      }

      const missingEntries = requiredEntries.filter(entry => 
        !gitignoreContent.includes(entry.replace('# ', ''))
      );

      if (missingEntries.length > 0) {
        const newContent = gitignoreContent + '\n\n' + missingEntries.join('\n') + '\n';
        fs.writeFileSync(gitignorePath, newContent);
        this.log('Updated .gitignore with security entries');
      } else {
        this.log('.gitignore already contains security entries');
      }
    } catch (error) {
      this.log(`Failed to update .gitignore: ${error.message}`, true);
    }
  }

  async createKeepFiles() {
    console.log('\n📄 Creating .gitkeep files...');
    
    const keepFiles = [
      'storage/uploads/.gitkeep',
      'logs/.gitkeep'
    ];

    keepFiles.forEach(file => {
      try {
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, '');
          this.log(`Created ${file}`);
        }
      } catch (error) {
        this.log(`Failed to create ${file}: ${error.message}`, true);
      }
    });
  }

  async backupConfiguration() {
    console.log('\n💾 Creating configuration backup...');
    
    const backupDir = 'storage/backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const filesToBackup = [
      'package.json',
      '.env',
      'storage/theme.json'
    ];

    filesToBackup.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const backupPath = path.join(backupDir, `${path.basename(file)}.${timestamp}.backup`);
          fs.copyFileSync(file, backupPath);
          this.log(`Backed up ${file} to ${backupPath}`);
        }
      } catch (error) {
        this.log(`Failed to backup ${file}: ${error.message}`, true);
      }
    });
  }

  async generateReport() {
    console.log('\n📊 Migration Summary');
    console.log('='.repeat(50));
    
    console.log(`\n✅ Successful changes: ${this.changes.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.changes.length > 0) {
      console.log('\n✅ Changes made:');
      this.changes.forEach((change, index) => {
        console.log(`${index + 1}. ${change}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Run: npm install (to install new dependencies)');
    console.log('2. Run: npm run security-audit (to verify security)');
    console.log('3. Restart the application');
    console.log('4. Review the security audit report');
    
    const report = {
      timestamp: new Date().toISOString(),
      changes: this.changes,
      errors: this.errors,
      success: this.errors.length === 0
    };

    fs.writeFileSync('security-migration-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: security-migration-report.json');
    
    return this.errors.length === 0;
  }

  async run() {
    console.log('🔧 Starting Security Migration for Impulse Panel');
    console.log('='.repeat(50));
    
    await this.backupConfiguration();
    await this.createSecureDirectories();
    await this.updateFilePermissions();
    await this.checkEnvironmentVariables();
    await this.updatePackageJson();
    await this.createGitignoreEntries();
    await this.createKeepFiles();
    
    const success = await this.generateReport();
    
    if (success) {
      console.log('\n🎉 Security migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Security migration completed with some errors.');
      console.log('Please review the errors above and fix them manually.');
      process.exit(1);
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new SecurityMigration();
  migration.run().catch(error => {
    console.error('❌ Security migration failed:', error.message);
    process.exit(1);
  });
}

module.exports = SecurityMigration;