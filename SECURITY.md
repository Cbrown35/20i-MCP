# Security Policy

## Overview

This repository is a **public, open-source MCP server** for the 20i hosting API. It contains no proprietary or sensitive data. All project-specific files, credentials, and deployment scripts are maintained separately from this public codebase.

## For Contributors

### What This Repository Contains
- ✅ Generic MCP server implementation for 20i API
- ✅ TypeScript source code without hardcoded credentials
- ✅ Example usage and documentation
- ✅ Test framework (credentials loaded from environment)
- ✅ Public documentation and guides

### What This Repository Does NOT Contain
- ❌ API keys, passwords, or authentication tokens
- ❌ Customer-specific deployment scripts
- ❌ Private domain names or email addresses
- ❌ Production environment configurations
- ❌ Client project files or data

## For Users

### Required Setup
Users must provide their own credentials via environment variables:
```bash
export TWENTYI_API_KEY="your-api-key"
export TWENTYI_OAUTH_KEY="your-oauth-key"
export TWENTYI_COMBINED_KEY="your-combined-key"
```

### Security Best Practices
1. **Never commit credentials** to any fork or clone of this repository
2. **Use environment variables** for all authentication
3. **Keep deployment scripts separate** from this public codebase
4. **Review code** before using in production environments
5. **Report vulnerabilities** via GitHub Security Advisories

## Directory Structure

### Public (Version Controlled)
```
/src            - Source code
/tests          - Test suites
/docs           - Public documentation
/scripts        - Utility scripts (no credentials)
```

### Private (Git Ignored)
```
/workspace      - Your working files
/archive        - Your deployment scripts
.env*           - Environment files
*.credentials   - Credential files
```

## Reporting Security Issues

If you discover a security vulnerability in this public codebase, please:
1. **Do NOT** create a public issue
2. Report via GitHub Security Advisories
3. Or email the maintainers directly
4. Include steps to reproduce the issue

## Compliance

This project follows security best practices:
- No hardcoded credentials in source code
- Environment-based configuration
- Clear separation of public/private assets
- Regular security audits of dependencies
- Comprehensive .gitignore patterns

## License Note

While this code is open source, users are responsible for:
- Securing their own API credentials
- Complying with 20i's terms of service
- Protecting their customer data
- Following their jurisdiction's data protection laws

---

Last Security Audit: January 2025