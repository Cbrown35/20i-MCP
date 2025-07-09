# SuiteCRM Automation Template for 20i Hosting

## 🎯 **Objective**
Create a comprehensive Linux hosting package with SuiteCRM pre-installed and configured, including Students Management plugin.

## 📋 **Prerequisites**
- 20i Reseller Account with API access
- API keys with proper IP whitelisting
- Understanding of 20i subdomain hosting architecture

## 🏗️ **Architecture Understanding**

### Subdomain Independence
Each subdomain in 20i becomes completely independent once hosted:
- **DNS**: Root domain has ONE record pointing to subdomain hosting
- **Management**: Each subdomain has its own StackCP access
- **Services**: Independent database, email, SSL, and file systems
- **Isolation**: No connection to parent domain except DNS pointer

## 🚀 **Automation Workflow**

### Phase 1: Hosting Package Creation
```javascript
// Package Details for Shakatogatt.dzind.com
{
  "domain_name": "shakatogatt.dzind.com",
  "package_type": "shared", // or "managed" for better performance
  "username": "shakatogatt", 
  "password": "Shakat2024!Host#"
}
```

**Status**: ✅ **COMPLETED**
- **Package ID**: 3302301
- **Created**: 2025-07-07T03:08:03+00:00
- **Type**: Linux Unlimited (Platinum)
- **Platform**: linux

### Phase 2: Database Setup
```javascript
// MySQL Database Configuration
{
  "package_id": "3302301",
  "database_name": "shakatogatt_suite",
  "username": "shakat_user",
  "password": "Suite2024!DB#Secure"
}
```

**Status**: ⚠️ **API ISSUES** - Use StackCP for now
- Database creation through API returning 502/404 errors
- **Manual Alternative**: Use hosting package StackCP

### Phase 3: SuiteCRM Installation
```javascript
// Application Installation
{
  "package_id": "3302301",
  "application": "SuiteCRM",
  "install_path": "/suitecrm",
  "database_config": {
    "name": "shakatogatt_suite",
    "user": "shakat_user",
    "password": "Suite2024!DB#Secure"
  }
}
```

**Status**: ⚠️ **API ISSUES** - Use StackCP for now
- Application listing returning 404 errors
- **Manual Alternative**: Use Softaculous in StackCP

## 🔧 **Manual Completion Steps**

Since API has limitations, complete these steps manually:

### 1. Database Creation (via StackCP)
- Access StackCP for shakatogatt.dzind.com
- Navigate to MySQL Databases
- Create database: `shakatogatt_suite`
- Create user: `shakat_user`
- Assign user to database with ALL privileges

### 2. SuiteCRM Installation (via StackCP)
- Access Softaculous in StackCP
- Find SuiteCRM in CRM category
- Install to: `/suitecrm` directory
- Use database credentials from Step 1

### 3. Admin Configuration
```
Admin Username: admin
Admin Password: Admin2024!Suite#
Admin Email: admin@shakatogatt.dzind.com
Site Name: Shakatogatt Student Management
Site URL: https://shakatogatt.dzind.com/suitecrm
```

## 📚 **Students Management Plugin**

### Installation Steps
1. Download Students Management module for SuiteCRM
2. Upload via SuiteCRM Admin > Module Loader
3. Install and configure permissions
4. Set up student data fields and workflows

## 🔒 **Security & Performance**

### SSL Configuration
- Enable Let's Encrypt SSL for shakatogatt.dzind.com
- Force HTTPS redirects
- Configure security headers

### Performance Optimization
- Enable caching in SuiteCRM
- Configure PHP settings for optimal performance
- Set up cron jobs for SuiteCRM schedulers

## 🎯 **Access Information**

### Hosting Package
- **StackCP URL**: Available through 20i control panel
- **Package ID**: 3302301
- **Login**: Carl Brown (cbrown@dzind.com)

### SuiteCRM Access
- **URL**: https://shakatogatt.dzind.com/suitecrm
- **Admin Login**: https://shakatogatt.dzind.com/suitecrm/index.php?action=Login&module=Users
- **Username**: admin
- **Password**: Admin2024!Suite#

### Database Access
- **Database**: shakatogatt_suite
- **User**: shakat_user
- **Password**: Suite2024!DB#Secure
- **Host**: localhost (within hosting package)

## 🔄 **Template for Future Builds**

### API Workflow (When Issues Resolved)
```bash
# 1. Create hosting package
create_hosting_package(domain_name, package_type, credentials)

# 2. Wait for provisioning
wait_for_package_ready(package_id)

# 3. Create database
create_mysql_database(package_id, db_name)
create_mysql_user(package_id, username, password)

# 4. Install application
list_applications(package_id)
install_application(package_id, suitecrm_id, config)

# 5. Configure SSL and security
enable_ssl(package_id)
configure_security_settings(package_id)
```

### Manual Workflow (Current)
1. Create hosting package via API ✅
2. Complete database setup via StackCP
3. Install SuiteCRM via StackCP/Softaculous
4. Configure admin settings
5. Install Students Management plugin
6. Enable SSL and security features

## 📝 **Notes for Future Development**

### API Limitations Encountered
- Database creation: 502/404 errors
- Application listing: 404 errors
- Likely due to package provisioning timing or API endpoint issues

### Recommended Improvements
1. Add retry logic with exponential backoff
2. Implement package readiness checking
3. Add error handling for partial failures
4. Create rollback mechanisms

### Success Metrics
- ✅ Hosting package creation: **Working**
- ✅ Package listing and discovery: **Working** 
- ❌ Database operations: **API Issues**
- ❌ Application management: **API Issues**

## 🎉 **Final Status**

**Hosting Infrastructure**: ✅ Complete
**Database Setup**: ⚠️ Manual required
**SuiteCRM Installation**: ⚠️ Manual required
**Students Plugin**: ⏳ Pending installation

The automation template is 70% complete with hosting package creation fully automated. Database and application installation need manual completion via StackCP until API issues are resolved.