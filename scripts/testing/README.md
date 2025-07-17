# Testing Scripts

This directory contains scripts for testing and validating the 20i API integration and deployment functionality.

## Available Scripts

### API Connection Testing
- **`test-api-connection.js`** - Verify 20i API credentials and basic connectivity
- **`check-hosting-packages.js`** - Test package listing and information retrieval
- **`debug-package.js`** - Debug specific package configurations and issues

### Database Testing
- **`test-mysql-user.js`** - Test MySQL user creation and database operations

## Usage

### Basic API Testing
```bash
# Test API credentials and connectivity
node scripts/testing/test-api-connection.js

# Check hosting packages
node scripts/testing/check-hosting-packages.js
```

### Database Testing
```bash
# Test MySQL operations
node scripts/testing/test-mysql-user.js
```

### Package Debugging
```bash
# Debug specific package issues
node scripts/testing/debug-package.js
```

## What These Scripts Test

### API Connection Tests
- ✅ Reseller account access
- ✅ Account balance retrieval
- ✅ Domain listing functionality
- ✅ Package enumeration
- ✅ Authentication token validation

### Package Tests
- ✅ Package information retrieval
- ✅ Web configuration access
- ✅ Service availability
- ✅ Usage statistics

### Database Tests
- ✅ MySQL database creation
- ✅ User creation and permissions
- ✅ Grant API functionality
- ✅ Database connectivity

## Environment Variables Required

```bash
TWENTYI_API_KEY=your_api_key
TWENTYI_OAUTH_KEY=your_oauth_key  
TWENTYI_COMBINED_KEY=your_combined_key
```

## Common Test Workflows

### 1. Initial Setup Verification
```bash
# Test basic API access
node scripts/testing/test-api-connection.js

# Verify package access
node scripts/testing/check-hosting-packages.js
```

### 2. Database Functionality Testing
```bash
# Test database operations
node scripts/testing/test-mysql-user.js
```

### 3. Troubleshooting API Issues
```bash
# Debug package-specific problems
node scripts/testing/debug-package.js
```

## Expected Output

### Successful API Test
```
🔍 Testing 20i API connection...

1. Testing reseller account access...
✅ Reseller info retrieved successfully
   Reseller ID: your-reseller-id

2. Testing account balance...
✅ Account balance retrieved successfully
   Balance: £X.XX

3. Testing domain listing...
✅ Domain API works
   Domains found: X

4. Testing package listing...
✅ Package API works
   Packages found: X

🎉 All API tests passed!
```

### Failed API Test
```
❌ API test failed: [error details]
   Status: 401
   Data: {"error": "Authentication failed"}
```

## Integration with Main Project

These testing scripts validate the same API endpoints that are used by:
- The main MCP server (`src/index.ts`)
- The modular domain and package modules
- The WordPress deployment scripts

## Automated Testing

Consider integrating these scripts into your CI/CD pipeline:
```bash
# Add to package.json scripts
"test:api": "node scripts/testing/test-api-connection.js",
"test:packages": "node scripts/testing/check-hosting-packages.js",
"test:db": "node scripts/testing/test-mysql-user.js"
```

## Related Scripts

- `../wordpress/` - WordPress deployment scripts that rely on these API functions
- `../automation/` - Automation scripts that use the tested endpoints
- `../../src/core/client.ts` - Main API client that implements these same endpoints