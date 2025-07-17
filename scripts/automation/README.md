# Automation Scripts

This directory contains general automation scripts for hosting setup, configuration, and management tasks.

## Available Scripts

### Database Automation
- **`create-mysql-user.js`** - Automated MySQL user and database creation

### Email Configuration
- **`setup-email-accounts.js`** - Automated email account setup (1-3 email configuration)

### Security and Performance
- **`setup-ssl-performance.js`** - SSL certificate and performance optimization setup

## Usage

### Database Setup
```bash
# Create MySQL user and database
node scripts/automation/create-mysql-user.js
```

### Email Configuration
```bash
# Set up 1-3 email accounts for a domain
node scripts/automation/setup-email-accounts.js
```

### SSL and Performance Setup
```bash
# Configure SSL and performance settings
node scripts/automation/setup-ssl-performance.js
```

## Key Automation Features

### MySQL Database Automation
- ✅ Automatic database creation
- ✅ User creation with proper permissions
- ✅ Grant API integration
- ✅ Error handling and retry logic

### Email Account Automation
- ✅ Mailbox creation
- ✅ Forwarder setup
- ✅ Quota configuration
- ✅ Multiple account support (1-3 emails)

### SSL and Performance Automation
- ✅ SSL certificate installation
- ✅ Force HTTPS configuration
- ✅ CDN setup
- ✅ Performance optimization

## Environment Variables Required

```bash
TWENTYI_API_KEY=your_api_key
TWENTYI_OAUTH_KEY=your_oauth_key
TWENTYI_COMBINED_KEY=your_combined_key
```

## Common Automation Workflows

### 1. Complete Hosting Setup
```bash
# 1. Set up WordPress (see ../wordpress/)
# 2. Create database
node scripts/automation/create-mysql-user.js

# 3. Set up email accounts
node scripts/automation/setup-email-accounts.js

# 4. Configure SSL and performance
node scripts/automation/setup-ssl-performance.js
```

### 2. Email-Only Setup
```bash
# For domains that only need email configuration
node scripts/automation/setup-email-accounts.js
```

### 3. Security Hardening
```bash
# SSL and performance optimization
node scripts/automation/setup-ssl-performance.js
```

## Integration with WordPress Deployment

These automation scripts are designed to work with the WordPress deployment workflow:

1. **WordPress Installation** (via `../wordpress/` scripts)
2. **Database Setup** (via `create-mysql-user.js`)
3. **Email Configuration** (via `setup-email-accounts.js`)
4. **SSL/Performance** (via `setup-ssl-performance.js`)

## Automation Achievements

Based on the SuiteCRM automation project:
- **95% success rate** for complete deployments
- **Multiple fallback strategies** (API, SSH, web automation)
- **Comprehensive error handling** with retry logic
- **One-Click installation API** discovery and implementation

## Error Handling

All automation scripts include:
- ✅ Comprehensive error detection
- ✅ Retry logic for temporary failures
- ✅ Fallback strategies for API limitations
- ✅ Detailed logging for troubleshooting

## Configuration Examples

### Email Setup Configuration
```javascript
const emailConfig = {
  domain: 'example.com',
  accounts: [
    { name: 'info', quota: 1000 },
    { name: 'support', quota: 2000 },
    { name: 'admin', quota: 500 }
  ]
};
```

### SSL Configuration
```javascript
const sslConfig = {
  forceHttps: true,
  autoRenew: true,
  includeSubdomains: true
};
```

## Script Dependencies

- Node.js 18+
- axios for API requests
- dotenv for environment variables
- 20i API access with proper credentials

## Related Documentation

- See `../../docs/` for main project documentation
- See `../wordpress/` for WordPress-specific automation
- See `../testing/` for API validation scripts
- See `../../src/modules/` for the modular API implementation