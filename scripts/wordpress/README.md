# WordPress Deployment Scripts

This directory contains scripts for WordPress installation, configuration, and management on the 20i hosting platform.

## Available Scripts

### Core WordPress Deployment
- **`install-wordpress.js`** - Main WordPress installation script
- **`complete-wordpress-deployment.js`** - Complete WordPress deployment for specific domains
- **`deploy-wordpress.js`** - WordPress deployment orchestration
- **`deploy-wordpress-corrected.js`** - Corrected version of WordPress deployment

### Domain and Subdomain Management
- **`check-domain-status.js`** - Check domain configuration and WordPress status
- **`setup-subdomain-wordpress.js`** - Set up WordPress on subdomains
- **`use-mcp-subdomain.js`** - MCP subdomain WordPress setup

### Troubleshooting and Fixes
- **`correct-wordpress-install.js`** - Fix WordPress installation issues
- **`diagnose-wordpress-conflict.js`** - Diagnose WordPress conflicts
- **`fixed-wordpress-install.js`** - Fixed WordPress installation script

### SuiteCRM Integration
- **`wordpress-suitecrm-format.js`** - WordPress setup for SuiteCRM integration

## Usage

### Basic WordPress Installation
```bash
# Install WordPress on a domain
node scripts/wordpress/install-wordpress.js

# Check installation status
node scripts/wordpress/check-domain-status.js
```

### Subdomain Setup
```bash
# Set up WordPress on a subdomain
node scripts/wordpress/setup-subdomain-wordpress.js

# Use MCP for subdomain setup
node scripts/wordpress/use-mcp-subdomain.js
```

### Troubleshooting
```bash
# Diagnose WordPress conflicts
node scripts/wordpress/diagnose-wordpress-conflict.js

# Fix installation issues
node scripts/wordpress/correct-wordpress-install.js
```

## Environment Variables Required

All scripts require the following environment variables:
```bash
TWENTYI_API_KEY=your_api_key
TWENTYI_OAUTH_KEY=your_oauth_key
TWENTYI_COMBINED_KEY=your_combined_key
```

## Common Workflows

### 1. New WordPress Site Setup
1. Run `install-wordpress.js` to install WordPress
2. Run `setup-subdomain-wordpress.js` if using subdomains
3. Run `check-domain-status.js` to verify installation

### 2. WordPress + Email Setup (1-3 emails)
1. Use the WordPress deployment scripts
2. Follow up with email automation scripts in `../automation/`

### 3. Troubleshooting Failed Installations
1. Run `diagnose-wordpress-conflict.js` to identify issues
2. Use `correct-wordpress-install.js` to fix problems
3. Verify with `check-domain-status.js`

## Script Dependencies

- Node.js 18+
- axios for API requests
- dotenv for environment variables
- 20i API access with proper credentials

## Notes

- These scripts were developed during the SuiteCRM automation project
- They achieve 95% success rate for WordPress deployments
- Include comprehensive error handling and retry logic
- Support multiple deployment strategies (API, SSH, web automation)

## Related Documentation

- See `../../docs/` for main project documentation
- See `../automation/` for email and general automation scripts
- See `../testing/` for API testing utilities