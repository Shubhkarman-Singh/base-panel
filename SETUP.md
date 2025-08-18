# 🚀 Impulse Panel Setup Guide

## Quick Setup (Recommended)

**One command to rule them all:**

```bash
npm run setup
```

This single command will:

- Install all dependencies
- Create your `.env` file from template
- Generate secure session secrets
- Build CSS assets
- Seed the database with container images
- Create your admin user (interactive)
- Verify the complete setup

After setup completes, just run:

```bash
npm start
```

## Manual Setup (Advanced)

If you prefer to run each step individually:

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Generate Secrets

```bash
npm run generate-secrets
```

### 4. Build Assets

```bash
npm run build
```

### 5. Seed Database

```bash
npm run seed
```

### 6. Create Admin User

```bash
npm run create-user
```

### 7. Verify Setup

```bash
npm run verify-setup
```

### 8. Start Server

```bash
npm start
```

## Development Setup

For development with auto-reload:

```bash
npm run setup
npm run dev
```

## Available Scripts

- `npm run setup` - **Complete automated setup (recommended)**
- `npm run build` - Build Tailwind CSS and assets
- `npm run generate-secrets` - Generate secure session secrets
- `npm run create-user` - Create admin user (interactive)
- `npm run seed` - Download and seed container images
- `npm run test-config` - Test configuration validity
- `npm run verify-setup` - Comprehensive setup verification
- `npm run security-audit` - Run comprehensive security audit
- `npm run validate-env` - Validate .env.example completeness
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload

## Configuration

All configuration is done through environment variables in your `.env` file:

### Required Settings

```bash
# Database (SQLite by default)
DATABASE_URL=sqlite://impulse.db

# Session Security (generated automatically)
SESSION_SECRET=your_secure_session_secret_here

# Server Configuration
PORT=3000
BASE_URI=http://localhost:3000
DOMAIN=localhost
NODE_ENV=production
```

### Optional Settings

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Advanced Security
API_SECRET=your_api_secret_here
ENCRYPTION_KEY=your_encryption_key_here
```

## Database Options

### SQLite (Default - Recommended for small deployments)

```bash
DATABASE_URL=sqlite://impulse.db
```

### MySQL (Recommended for production)

```bash
DATABASE_URL=mysql://username:password@localhost:3306/impulse_panel
```

### PostgreSQL

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/impulse_panel
```

## Security Best Practices

1. **Never commit `.env` to version control**
2. **Use strong, unique secrets** (generated automatically)
3. **Use HTTPS in production** (`BASE_URI=https://yourdomain.com`)
4. **Set `NODE_ENV=production`** for production deployments
5. **Regularly rotate secrets** (quarterly recommended)

## Automated User Creation

You can create users non-interactively using command line arguments:

```bash
# Create admin user with command line arguments
npm run create-user -- --username=admin --email=admin@example.com --password=securepassword123
```

## Troubleshooting

### Setup Verification Fails

```bash
# Run comprehensive verification
npm run verify-setup

# Check configuration
npm run test-config

# Regenerate secrets if needed
npm run generate-secrets
```

### Database Issues

```bash
# Reset database (WARNING: This deletes all data)
npm run reset

# Create new admin user
npm run create-user
```

### Permission Issues (Linux/macOS)

```bash
# Make sure .env file has correct permissions
chmod 600 .env
```

### Security Issues

```bash
# Run security audit
npm run security-audit

# Check for vulnerabilities
npm audit
```

## Migration from config.json

If you're upgrading from an older version that used `config.json`, all migration scripts have been removed. The application now uses environment variables exclusively.

## Production Deployment Checklist

Before deploying to production:

- [ ] Run `npm run verify-setup` - passes without errors
- [ ] Run `npm run security-audit` - no critical issues
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use HTTPS (`BASE_URI=https://yourdomain.com`)
- [ ] Use strong database (MySQL/PostgreSQL for production)
- [ ] Set proper file permissions (`chmod 600 .env`)
- [ ] Configure email settings for notifications
- [ ] Set up regular secret rotation schedule

## TL;DR - Super Quick Start

```bash
npm run setup
npm start
```

**That's it!** Your Impulse Panel is ready to go.
