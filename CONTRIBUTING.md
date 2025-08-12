# 🤝 Contributing to Impulse Panel

Thank you for your interest in contributing to Impulse Panel! We welcome contributions from developers of all skill levels.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Security Contributions](#security-contributions)
- [Community](#community)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 16.x or higher
- **npm** or **yarn**
- **Git**
- Basic knowledge of JavaScript, Express.js, and web development

### Areas for Contribution

- 🐛 **Bug Fixes**: Help us squash bugs
- ✨ **New Features**: Add exciting new functionality
- 📚 **Documentation**: Improve our documentation
- 🔒 **Security**: Enhance security measures
- 🎨 **UI/UX**: Improve the user interface
- 🔌 **Plugins**: Create awesome plugins
- 🧪 **Testing**: Add or improve tests
- 🚀 **Performance**: Optimize performance

## 🛠️ Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/yourusername/panel.git
cd panel

# Add the original repository as upstream
git remote add upstream https://github.com/impulseOSS/panel.git
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Generate secure session secret
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Add the generated secret to your .env file
```

### 4. Database Setup

```bash
# Create your first admin user
npm run createUser

# Optional: Seed the database with sample data
npm run seed
```

### 5. Start Development Server

```bash
# Start with auto-reload
npm run start:dev

# Or start with browser sync for UI development
npm run dev
```

## 📝 Contributing Guidelines

### Code Style

- **JavaScript**: Follow existing code style and patterns
- **Indentation**: Use 2 spaces for indentation
- **Semicolons**: Use semicolons consistently
- **Naming**: Use camelCase for variables and functions
- **Comments**: Add meaningful comments for complex logic

### Security First

- **Never commit sensitive data** (passwords, API keys, etc.)
- **Use environment variables** for configuration
- **Validate all inputs** to prevent injection attacks
- **Follow security best practices** outlined in [SECURITY.md](SECURITY.md)
- **Run security audits** before submitting PRs

### File Structure

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

### Commit Messages

Use clear, descriptive commit messages:

```bash
# Good examples
git commit -m "Add rate limiting to authentication endpoints"
git commit -m "Fix user data exposure in /accounts endpoint"
git commit -m "Update README with security configuration guide"

# Bad examples
git commit -m "fix bug"
git commit -m "update stuff"
git commit -m "changes"
```

### Branch Naming

Use descriptive branch names:

```bash
# Feature branches
feature/add-2fa-support
feature/plugin-system
feature/api-rate-limiting

# Bug fix branches
fix/user-data-exposure
fix/session-security
fix/csrf-protection

# Documentation branches
docs/api-documentation
docs/security-guide
docs/contributing-guide
```

## 🔄 Pull Request Process

### 1. Create a Feature Branch

```bash
# Update your fork
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clean, well-documented code
- Follow existing patterns and conventions
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run the application
npm start

# Run security audit
node scripts/security-audit.js

# Test your specific changes thoroughly
```

### 4. Commit and Push

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "Add your descriptive commit message"

# Push to your fork
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out the PR template completely
5. Submit the pull request

### Pull Request Template

```markdown
## Description

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Security enhancement

## Testing

- [ ] I have tested this change locally
- [ ] I have run the security audit
- [ ] I have added tests for new functionality
- [ ] All existing tests pass

## Security Checklist

- [ ] No sensitive data is exposed
- [ ] Input validation is implemented
- [ ] Authentication/authorization is properly handled
- [ ] No new security vulnerabilities introduced

## Screenshots (if applicable)

Add screenshots to help explain your changes.

## Additional Notes

Any additional information or context about the PR.
```

## 🔒 Security Contributions

Security is our top priority. When contributing security-related changes:

### Security Bug Fixes

1. **Report privately first** via security@impulse.dev
2. Wait for acknowledgment before creating PR
3. Include detailed testing of the fix
4. Update security documentation if needed

### Security Features

1. **Discuss the approach** in an issue first
2. Follow security best practices
3. Include comprehensive testing
4. Update security documentation
5. Consider backward compatibility

### Security Review Process

All security-related PRs undergo additional review:

- Code review by security-focused maintainers
- Security testing and validation
- Documentation review
- Potential security audit

## 🧪 Testing Guidelines

### Manual Testing

- Test your changes in different browsers
- Test with different user roles (admin, regular user)
- Test error conditions and edge cases
- Verify security measures work correctly

### Automated Testing

```bash
# Run existing tests (if available)
npm test

# Run security audit
node scripts/security-audit.js

# Check for vulnerabilities
npm audit
```

### Test Coverage

When adding new features:

- Add unit tests for utility functions
- Add integration tests for API endpoints
- Test error handling and edge cases
- Verify security measures

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for functions and classes
- Include parameter and return type information
- Explain complex logic with inline comments
- Update README if adding new features

### API Documentation

- Document new API endpoints
- Include request/response examples
- Specify required permissions
- Update API version if needed

## 🔌 Plugin Development

### Creating Plugins

```javascript
// plugins/my-plugin/index.js
module.exports = {
  config: {
    name: "My Plugin",
    version: "1.0.0",
    description: "A sample plugin",
    author: "Your Name",
  },

  init: (app, db) => {
    // Plugin initialization
    app.get("/plugin/my-plugin", (req, res) => {
      res.json({ message: "Hello from my plugin!" });
    });
  },
};
```

### Plugin Guidelines

- Follow the plugin architecture
- Include proper error handling
- Document plugin functionality
- Test plugin compatibility
- Consider security implications

## 🎨 UI/UX Contributions

### Design Guidelines

- Follow existing design patterns
- Use Tailwind CSS classes consistently
- Ensure responsive design
- Consider accessibility (WCAG guidelines)
- Test on different screen sizes

### Frontend Development

```bash
# Build CSS during development
npm run build:css

# Start with browser sync for live reload
npm run dev
```

## 🚀 Performance Contributions

### Performance Guidelines

- Profile before and after changes
- Consider memory usage
- Optimize database queries
- Minimize network requests
- Use appropriate caching strategies

### Performance Testing

- Test with realistic data volumes
- Monitor memory usage
- Check response times
- Verify scalability

## 🌟 Recognition

Contributors are recognized in several ways:

- **GitHub Contributors**: Automatic recognition on GitHub
- **Changelog**: Major contributions mentioned in releases
- **Hall of Fame**: Special recognition for significant contributions
- **Maintainer Status**: Outstanding contributors may be invited as maintainers

## 💬 Community

### Getting Help

- **Discord**: [Join our community](https://discord.gg/impulse)
- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs and request features

### Communication Guidelines

- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and experiences
- Provide constructive feedback

## 📞 Contact

For questions about contributing:

- **Discord**: [Join our community](https://discord.gg/impulse)
- **Email**: contribute@impulse.dev
- **GitHub**: Create an issue or discussion

---

Thank you for contributing to Impulse Panel! Together, we're building something amazing. 🚀
