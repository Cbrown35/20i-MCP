# SuiteCRM Cleanup Requirements

## Current Situation
Multiple SuiteCRM installation attempts have been made with various automation approaches. Need to clean up existing installation before starting fresh.

## What Needs to be Deleted

### 1. Hosting Package
- Package containing SuiteCRM installation
- Likely named with pattern: `suitecrm*` or contains domain like `suite*.com`
- Check for packages created in last 7 days

### 2. MySQL Database
- Database name pattern: `suite*`, `crm*`, or custom name
- Created during installation attempts
- May have multiple databases from different attempts

### 3. MySQL Users
- User pattern: `suite*`, `crm*`, or custom username
- Associated with SuiteCRM databases
- Need to revoke all permissions before deletion

### 4. Files/Directories
- SuiteCRM installation files in public_html or subdirectory
- Any backup files created during attempts
- Configuration files (config.php, etc.)

### 5. FTP Users (if created)
- Any FTP users created for SuiteCRM access
- Pattern: `suite*`, `crm*`

## Cleanup Process

### Using 20i MCP Tools:
1. **List hosting packages** - Find SuiteCRM package
2. **Get MySQL databases** - Identify SuiteCRM databases
3. **Get MySQL users** - Identify associated users
4. **Delete in order**:
   - Remove MySQL user permissions
   - Delete MySQL users
   - Delete MySQL databases
   - Delete hosting package (removes all files)

### Manual Verification Needed:
- Package ID containing SuiteCRM
- Exact database names
- Exact usernames

## Why Starting Fresh

### Previous Attempts Issues:
1. **Database Configuration**: Connection issues with credentials
2. **File Permissions**: Incorrect permissions on config files
3. **Installation State**: Partial installations leaving inconsistent state
4. **Multiple Attempts**: Overlapping configurations from different approaches

### Benefits of Fresh Start:
1. Clean installation environment
2. No conflicting configurations
3. Proper automation from beginning
4. Consistent naming conventions

## Next Deployment Strategy

### Improved Approach:
1. Use discovered One-Click API: `/package/{id}/oneclick/install`
2. Pre-create database and user with proper permissions
3. Use MySQL Grant API for user creation
4. Automate entire flow with proper error handling

### Key Learnings Applied:
- Session persistence for multi-step operations
- Proper MySQL user permissions via Grant API
- Correct file permissions from start
- Single automation script vs multiple attempts

## Verification Commands

To find SuiteCRM installations:
```bash
# Find packages
grep -i "suite" testing-files/*.json

# Check recent automations
ls -la automation/*suite*.js | tail -10

# Review test results
cat testing-files/test-results-*.json | grep -i suite
```

## Important Notes
- Must delete in correct order to avoid orphaned resources
- Verify complete deletion before new installation
- Document exact names/IDs for future reference
- Consider using test subdomain first

---
Created: 2025-01-08
Purpose: Clean slate for improved SuiteCRM automation