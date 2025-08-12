# 🚀 Impulse Panel

<div align="center">

![Impulse Panel Logo](public/assets/logo.png)

**A powerful, secure, and modern control panel for managing game servers and applications**

[![GitHub contributors](https://img.shields.io/github/contributors/impulseOSS/panel?style=for-the-badge)](https://github.com/impulseOSS/panel/graphs/contributors)
[![GitHub forks](https://img.shields.io/github/forks/impulseOSS/panel?style=for-the-badge)](https://github.com/impulseOSS/panel/network/members)
[![GitHub stars](https://img.shields.io/github/stars/impulseOSS/panel?style=for-the-badge)](https://github.com/impulseOSS/panel/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/impulseOSS/panel?style=for-the-badge)](https://github.com/impulseOSS/panel/issues)
[![GitHub license](https://img.shields.io/github/license/impulseOSS/panel?style=for-the-badge)](https://github.com/impulseOSS/panel/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/impulseOSS/panel?style=for-the-badge)](https://github.com/impulseOSS/panel/commits/main)

[📖 Documentation](https://impulse.dev) • [🐛 Report Bug](https://github.com/impulseOSS/panel/issues) • [✨ Request Feature](https://github.com/impulseOSS/panel/issues) • [💬 Discord](https://discord.gg/impulse)

</div>

---

## 🌟 Features

### 🔒 **Enterprise-Grade Security**
- **Multi-layer authentication** with 2FA support
- **Advanced rate limiting** with exponential backoff
- **CSRF protection** on all forms and API endpoints
- **Secure session management** with automatic expiration
- **Input validation & sanitization** preventing injection attacks
- **API key management** with granular permissions
- **Comprehensive audit logging** for all security events

### 🎮 **Game Server Management**
- **Multi-instance support** for various game types
- **Real-time monitoring** and performance metrics
- **Automated backups** and restore functionality
- **Plugin system** for extensibility
- **WebSocket integration** for live updates

### 🛠️ **Developer Experience**
- **RESTful API** with comprehensive documentation
- **Modern web interface** built with Tailwind CSS
- **Plugin architecture** for custom functionality
- **Comprehensive logging** with sensitive data protection
- **Security audit tools** built-in

### 🚀 **Production Ready**
- **Environment-based configuration** for secure deployments
- **Database flexibility** (SQLite, MySQL support)
- **Docker support** for containerized deployments
- **Horizontal scaling** capabilities
- **Health monitoring** and alerting

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16.x or higher
- **npm** or **yarn** package manager
- **SQLite** (default) or **MySQL** database

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/impulseOSS/panel.git
cd panel

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configuration

Create your environment configuration:

```bash
# Copy the example environment file
cp .env.example .env

# Generate secure secrets
node -e "
  const crypto = require('crypto');
  console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'));
  console.log('API_SECRET=' + crypto.randomBytes(32).toString('hex'));
  console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
"

# Edit .env with your configuration
nano .env
```

**Essential Configuration:**
```bash
# Required Settings
SESSION_SECRET=your_generated_64_byte_secret
DATABASE_URL=sqlite://impulse.db
PORT=3000
BASE_URI=http://localhost:3000
NODE_ENV=production

# Optional Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 3. Database Setup

```bash
# Create your first admin user
npm run createUser

# Seed the database (optional)
npm run seed
```

### 4. Launch

```bash
# Production
npm start

# Development with auto-reload
npm run start:dev

# Development with browser sync
npm run dev
```

Visit `http://localhost:3000` and log in with your admin credentials!

---

## 🔧 Configuration Guide

### Environment Variables

All configuration is managed through environment variables in your `.env` file:

```bash
# ==============================================
# 🔒 CRITICAL SECURITY SETTINGS
# ==============================================

# Session Security (REQUIRED)
SESSION_SECRET=your_secure_64_byte_session_secret_here

# ==============================================
# 🗄️ DATABASE CONFIGURATION
# ==============================================

# SQLite (recommended for development)
DATABASE_URL=sqlite://impulse.db

# MySQL (recommended for production)
# DATABASE_URL=mysql://username:password@localhost:3306/impulse_panel

# PostgreSQL (alternative for production)
# DATABASE_URL=postgresql://username:password@localhost:5432/impulse_panel

# ==============================================
# 🌐 SERVER CONFIGURATION
# ==============================================

PORT=3000
BASE_URI=http://localhost:3000
DOMAIN=localhost
NODE_ENV=production

# ==============================================
# 🎨 APPLICATION SETTINGS
# ==============================================

VERSION=0.0.1
VERSION_STATE=alpha
SALT_ROUNDS=10
OG_TITLE=Impulse Panel
OG_DESCRIPTION=Modern control panel for managing game servers and applications

# ==============================================
# 📧 EMAIL CONFIGURATION (Optional)
# ==============================================

# Gmail Example
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# ==============================================
# 🔐 ADVANCED SECURITY (Optional)
# ==============================================

API_SECRET=your_secure_api_secret_here
ENCRYPTION_KEY=your_32_byte_encryption_key_here
JWT_SECRET=your_jwt_secret_here
```

### Configuration Validation

Test your configuration anytime:

```bash
# Validate all settings
npm run test-config

# Run security audit
npm run security-audit

# Generate new secrets
npm run regen-secret
```

---

## 🔒 Security Features

### Built-in Security Measures

- **🛡️ CSRF Protection**: All forms protected against cross-site request forgery
- **🔐 Rate Limiting**: Advanced rate limiting with exponential backoff
- **🔑 2FA Support**: Time-based one-time passwords (TOTP)
- **📝 Input Validation**: Comprehensive validation and sanitization
- **🔍 Audit Logging**: Complete audit trail of all actions
- **🚫 Data Sanitization**: Automatic removal of sensitive data from logs and responses

### Security Tools

```bash
# Run comprehensive security audit
npm run security-audit

# Test configuration security
npm run test-config

# Generate new session secret
npm run regen-secret

# Generate all secrets at once
node -e "
  const crypto = require('crypto');
  console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'));
  console.log('API_SECRET=' + crypto.randomBytes(32).toString('hex'));
  console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
  console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));
"
```

---

## 📚 API Documentation

### Authentication

All API endpoints require authentication via API keys or session cookies.

```bash
# Create API key (admin required)
POST /admin/api-keys
{
  "name": "My API Key",
  "permissions": ["user:create", "instance:manage"],
  "expiresIn": "1y"
}

# Use API key
curl -H "Authorization: Bearer your_api_key" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/v1/users
```

### Core Endpoints

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| `GET` | `/api/v1/users` | List all users | `user:read` |
| `POST` | `/api/v1/users` | Create new user | `user:create` |
| `GET` | `/api/v1/instances` | List instances | `instance:read` |
| `POST` | `/api/v1/instances` | Create instance | `instance:create` |
| `DELETE` | `/api/v1/instances/:id` | Delete instance | `instance:delete` |

---

## 🔌 Plugin Development

### Creating a Plugin

```javascript
// plugins/my-plugin/index.js
module.exports = {
  config: {
    name: "My Plugin",
    version: "1.0.0",
    description: "A sample plugin",
    author: "Your Name"
  },
  
  init: (app, db) => {
    // Plugin initialization
    app.get('/plugin/my-plugin', (req, res) => {
      res.json({ message: 'Hello from my plugin!' });
    });
  }
};
```

### Plugin Structure

```
plugins/
├── my-plugin/
│   ├── index.js          # Main plugin file
│   ├── package.json      # Plugin metadata
│   ├── routes/           # Plugin routes
│   ├── views/            # Plugin templates
│   └── public/           # Static assets
```

---

## 🐳 Docker Deployment

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  impulse:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://impulse:password@db:3306/impulse
      - SESSION_SECRET=your_secure_session_secret
    volumes:
      - ./data:/app/data
    depends_on:
      - db

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=impulse
      - MYSQL_USER=impulse
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

```bash
# Deploy with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f impulse

# Scale the application
docker-compose up -d --scale impulse=3
```

---

## 🛠️ Development

### Development Setup

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Test configuration
npm run test-config

# Start development server with hot reload
npm run start:dev

# Start with browser sync for UI development
npm run dev

# Build CSS (if modifying styles)
npm run build:css
```

### Project Structure

```
impulse-panel/
├── handlers/             # Core application handlers
├── routes/              # Express route definitions
│   ├── API/            # API endpoints
│   ├── Admin/          # Admin panel routes
│   └── Dashboard/      # User dashboard routes
├── utils/              # Utility functions and security tools
├── views/              # EJS templates
├── public/             # Static assets
├── plugins/            # Plugin system
├── scripts/            # Utility scripts
└── storage/            # Application data storage
```

### Code Quality

```bash
# Run security audit
npm run security-audit

# Test configuration
npm run test-config

# Validate environment setup
npm run setup

# Generate new secrets
npm run regen-secret

# Lint code (if ESLint is configured)
npm run lint

# Run tests (if configured)
npm test
```

---

## 🚀 Production Deployment

### Security Checklist

- [ ] **Environment Variables**: All secrets in `.env` file (never commit to git)
- [ ] **Strong Secrets**: Generated with cryptographically secure methods
- [ ] **HTTPS**: SSL/TLS certificate configured for production
- [ ] **Database Security**: Strong passwords, restricted access
- [ ] **Firewall**: Only necessary ports exposed (typically 80, 443, 22)
- [ ] **File Permissions**: `.env` file restricted (`chmod 600 .env`)
- [ ] **Regular Updates**: Dependencies and security patches current
- [ ] **Monitoring**: Error tracking and security event monitoring
- [ ] **Backups**: Automated, encrypted backup strategy
- [ ] **Access Control**: Principle of least privilege for all accounts

### Performance Optimization

```bash
# Enable production mode
NODE_ENV=production

# Use process manager
npm install -g pm2
pm2 start index.js --name impulse-panel

# Monitor performance
pm2 monit

# Setup auto-restart
pm2 startup
pm2 save
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/yourusername/panel.git`
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes
5. **Test** thoroughly
6. **Commit** your changes: `git commit -m 'Add amazing feature'`
7. **Push** to the branch: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

### Development Guidelines

- **Security First**: All contributions must maintain security standards
- **Code Quality**: Follow existing code style and patterns
- **Documentation**: Update documentation for new features
- **Testing**: Include tests for new functionality
- **Performance**: Consider performance impact of changes

### Areas for Contribution

- 🐛 **Bug Fixes**: Help us squash bugs
- ✨ **New Features**: Add exciting new functionality
- 📚 **Documentation**: Improve our docs
- 🔒 **Security**: Enhance security measures
- 🎨 **UI/UX**: Improve the user interface
- 🔌 **Plugins**: Create awesome plugins

---

## 📞 Support & Community

### Getting Help

- 📖 **Documentation**: [impulse.dev](https://impulse.dev)
- 💬 **Discord**: [Join our community](https://discord.gg/impulse)
- 🐛 **Issues**: [GitHub Issues](https://github.com/impulseOSS/panel/issues)
- 📧 **Email**: support@impulse.dev

### Community Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and experiences
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 ImpulseOSS and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

- **Contributors**: Thank you to all our amazing contributors
- **Community**: Thanks to our supportive community
- **Open Source**: Built with love for the open source community
- **Security Researchers**: Thanks to those who help keep us secure

---

<div align="center">

**Made with ❤️ by [ImpulseOSS](https://github.com/impulseOSS)**

[⭐ Star us on GitHub](https://github.com/impulseOSS/panel) • [🐦 Follow on Twitter](https://twitter.com/impulseOSS) • [💬 Join Discord](https://discord.gg/impulse)

</div>
