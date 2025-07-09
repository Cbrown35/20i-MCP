# Manual MySQL User Creation Steps

## Current Status
- ✅ Package: 3302301 (shakatogatt.dzind.com) - READY
- ✅ Database: `shakatogatt_suite-35303934811` - CREATED
- ❌ MySQL User: MISSING (API 404 errors)

## Manual Steps Required

### 1. Access StackCP
1. Login to 20i control panel
2. Navigate to hosting package `shakatogatt.dzind.com` (ID: 3302301)
3. Click "Manage" to access StackCP

### 2. Create MySQL User
1. In StackCP, go to "MySQL Databases" section
2. Scroll to "Add MySQL User" section
3. Enter the following details:
   - **Username**: `shakatogatt_user`
   - **Password**: `Suite2024!DB#Secure`
4. Click "Create MySQL User"

### 3. Assign User to Database
1. In the "Manage MySQL Users" section
2. Find the database: `shakatogatt_suite-35303934811`
3. Select user: `shakatogatt_user`
4. Grant ALL privileges
5. Click "Add User to Database"

## Next Steps After User Creation
Once the MySQL user is created, we can proceed with:
1. SuiteCRM installation via Softaculous
2. SSL configuration
3. Students Management plugin installation

## Database Connection Details
```
Host: localhost
Database: shakatogatt_suite-35303934811
Username: shakatogatt_user
Password: Suite2024!DB#Secure
```

## API Issues Encountered
- `create_mysql_user` tool returns 404 errors
- Likely due to package provisioning timing or API endpoint limitations
- Manual creation via StackCP is the reliable alternative