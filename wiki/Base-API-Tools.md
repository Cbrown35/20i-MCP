# Base 20i API Tools (271 Tools)

These tools provide **complete coverage** of the 271 official 20i API endpoints, ensuring every major hosting function is accessible through AI assistants.

## 📊 **Coverage Overview**

- **Total Base Tools**: 271
- **API Coverage**: 100% of official 20i endpoints
- **Service Categories**: 15 major hosting service areas
- **Direct Mapping**: Each tool maps to a specific 20i API endpoint

---

## 🏢 **Account & Reseller Management**

### Core Account Tools
- `get_reseller_info` - Reseller account information and statistics
- `get_account_balance` - Account balance and billing information
- `list_hosting_packages` - All hosting packages in the account
- `get_hosting_package_info` - Detailed package information
- `create_hosting_package` - New hosting package creation

### Cloud Server Management
- `list_cloud_servers` - All cloud servers in account
- `create_cloud_server` - New cloud server provisioning
- `get_cloud_server_info` - Cloud server details and status
- `upgrade_cloud_server` - Server resource upgrades
- `cancel_cloud_server` - Server cancellation and cleanup

---

## 🌐 **Domain Management**

### Domain Operations
- `list_domains` - All domains in the reseller account
- `get_domain_info` - Detailed domain information
- `register_domain` - New domain name registration
- `search_domains` - Domain availability search and suggestions
- `get_domain_verification_status` - Domain verification status
- `resend_domain_verification_email` - Email verification resending

### Domain Transfer Management
- `get_domain_transfer_status` - Transfer status tracking
- `get_domain_auth_code` - EPP/authorization codes
- `initiate_domain_transfer` - Domain transfer initiation
- `cancel_domain_transfer` - Transfer cancellation
- `approve_domain_transfer` - Transfer approval workflow

### Domain Configuration
- `activate_domain` / `deactivate_domain` - Domain activation control
- `get_domain_contacts` - Domain contact information
- `update_domain_contacts` - Contact information updates
- `get_domain_privacy` - Privacy protection status
- `set_domain_privacy` - Privacy protection control

---

## 🌍 **DNS Management**

### DNS Records
- `get_dns_records` - DNS record retrieval for domains
- `update_dns_record` - DNS record creation and updates
- `delete_dns_record` - DNS record removal
- `get_nameservers` - Nameserver information
- `update_nameservers` - Nameserver configuration

### Advanced DNS
- `configure_dnssec` - DNSSEC security configuration
- `manage_virtual_nameservers` - Virtual nameserver setup
- `setup_google_apps_dns` - Google Apps DNS integration
- `setup_office365_dns` - Office 365 DNS integration
- `get_dns_default_settings` - Default DNS configuration

---

## 🖥️ **VPS Management (22 Tools)**

### VPS Lifecycle Control
- `list_vps` - All VPS instances in account
- `get_vps_info` - Detailed VPS information and status
- `start_vps` - VPS instance startup
- `stop_vps` - VPS instance shutdown
- `reboot_vps` - VPS instance restart
- `rebuild_vps` - VPS OS reinstallation

### VPS Configuration
- `activate_vps` / `deactivate_vps` - VPS activation control
- `get_vps_limits` - VPS resource limits and quotas
- `get_vps_backups` - VPS backup information
- `get_vps_disks` - VPS disk allocation and usage
- `get_vps_operating_systems` - Available OS options
- `change_vps_password` - VPS root password management

### VPS Access & Security
- `get_vps_vnc_console` - VNC console access for troubleshooting
- `lock_vps_vnc` / `unlock_vps_vnc` - VNC security controls
- `configure_vps_reverse_dns` - Reverse DNS configuration
- `get_vps_ipv6_addresses` - IPv6 address management
- `update_vps_name` - VPS identification and naming

### Managed VPS
- `list_managed_vps` - All managed VPS instances
- `get_managed_vps_info` - Managed VPS details
- `get_managed_vps_limits` - Managed VPS resource limits
- `set_managed_vps_profile` - Profile configuration
- `reset_managed_vps_profile` - Profile reset operations

---

## 🗄️ **Database Management**

### MSSQL Database Services (8 Tools)
- `list_mssql_databases` - All MSSQL databases across packages
- `get_mssql_database_details` - MSSQL database information
- `create_mssql_database` - New MSSQL database creation
- `delete_mssql_database` - MSSQL database removal
- `assign_mssql_to_package` - Database package assignment
- `order_mssql_database` - MSSQL database ordering
- `renew_mssql_database` - MSSQL database renewal

### MSSQL User Management
- `add_mssql_user` - MSSQL database user creation
- `remove_mssql_user` - MSSQL user removal
- `update_mssql_user_password` - MSSQL user password updates

### MySQL Database Services
- `list_mysql_databases` - All MySQL databases
- `create_mysql_database` - MySQL database creation
- `remove_mysql_database` - MySQL database removal
- `list_mysql_users` - MySQL database users
- `create_mysql_user` - MySQL user creation
- `remove_mysql_user` - MySQL user removal
- `update_mysql_user_password` - MySQL password management
- `get_mysql_user_grants` - MySQL user permissions

---

## 📧 **Email Management**

### Email Account Operations
- `create_email_account` - Email account creation
- `get_email_config` - Email account configuration
- `update_email_config` - Email settings updates
- `delete_email_account` - Email account removal
- `get_webmail_url` - Webmail access URL generation

### Email Forwarding
- `create_email_forwarder` - Email forwarding setup
- `get_all_email_forwarders` - Email forwarder listing
- `update_email_forwarder` - Forwarder configuration updates
- `delete_email_forwarder` - Email forwarder removal

### Email Security
- `get_dkim_signature` / `set_dkim_signature` - DKIM authentication
- `get_dmarc_policy` / `set_dmarc_policy` - DMARC policy management
- `get_email_spam_settings` - Spam filtering configuration
- `update_email_spam_settings` - Spam filter updates

### Email Domain Management
- `get_email_domain_config` - Email domain configuration
- `create_email_domain_alias` - Domain alias setup
- `get_email_stats` - Email usage statistics

---

## 🔒 **SSL Certificate Management (11 Tools)**

### Certificate Lifecycle
- `list_ssl_certificates` - All SSL certificates
- `order_ssl_certificate` - SSL certificate ordering
- `renew_ssl_certificate` - Certificate renewal
- `precheck_ssl_renewal` - Renewal validation
- `get_ssl_certificate_status` - Certificate status monitoring

### Certificate Installation
- `install_external_ssl_certificate` - External certificate installation
- `remove_ssl_certificates` - Certificate removal
- `toggle_free_ssl` - Let's Encrypt management
- `resend_ssl_approval_email` - Certificate approval workflow

### SSL Configuration
- `get_force_ssl_status` / `set_force_ssl` - HTTPS enforcement
- `get_ssl_force_status` - SSL redirect status

---

## 📦 **Package Management**

### Package Operations
- `activate_package` / `deactivate_package` - Package activation control
- `get_package_info` - Package details and configuration
- `get_package_limits` - Package resource limits
- `get_package_usage` - Package usage statistics
- `delete_package` - Package removal

### Package Administration
- `split_package` - Package domain splitting
- `clone_package` - Package duplication
- `transfer_package` - Package ownership transfer
- `update_package_allowances` - Resource allocation updates

---

## 🎯 **WordPress Management**

### WordPress Installation
- `list_wordpress_sites` - WordPress installations
- `install_wordpress` - WordPress installation
- `get_wordpress_version` - Version information
- `update_wordpress` - WordPress core updates
- `get_wordpress_staging` - Staging environment management

### WordPress Content Management
- `list_wordpress_plugins` - Plugin inventory
- `install_wordpress_plugin` - Plugin installation
- `activate_wordpress_plugin` - Plugin activation
- `update_wordpress_plugin` - Plugin updates
- `remove_wordpress_plugin` - Plugin removal

### WordPress Themes
- `list_wordpress_themes` - Theme inventory
- `install_wordpress_theme` - Theme installation
- `activate_wordpress_theme` - Theme activation
- `set_wordpress_theme` - Theme switching

### WordPress Users
- `list_wordpress_users` - User management
- `create_wordpress_user` - User creation
- `update_wordpress_user` - User updates
- `delete_wordpress_user` - User removal

---

## 📁 **File & FTP Management**

### FTP Operations
- `create_ftp_user` - FTP user creation
- `list_ftp_users` - FTP user listing
- `update_ftp_user` - FTP user configuration
- `delete_ftp_user` - FTP user removal
- `get_ftp_credentials` - FTP access credentials

### File Permissions
- `get_file_permissions` - File permission status
- `set_file_permissions` - Permission updates
- `get_directory_index` - Directory index configuration
- `set_directory_index` - Index file configuration

---

## ⚙️ **PHP & Application Management**

### PHP Configuration
- `get_php_versions` - Available PHP versions
- `get_current_php_version` - Current PHP version
- `set_php_version` - PHP version switching
- `get_php_config` - PHP configuration settings
- `update_php_config` - PHP setting updates

### Application Management
- `list_installed_applications` - Installed applications
- `install_application` - One-click application installation
- `remove_application` - Application removal
- `get_application_status` - Application status monitoring

---

## 🔧 **System & Utility Tools**

### System Information
- `get_system_status` - System health status
- `get_disk_usage` - Disk space utilization
- `get_bandwidth_stats` - Bandwidth usage statistics
- `get_access_logs` - Access log retrieval

### Maintenance Operations
- `clear_cache` - Cache clearing operations
- `restart_services` - Service restart capabilities
- `run_maintenance_tasks` - System maintenance automation

---

## 📈 **Usage Examples**

### Basic Domain Registration
```
"Register the domain example.com with standard contact information"
```

### VPS Management
```
"Start my VPS server with ID vps-12345"
"Get the current status of all my VPS instances"
```

### Email Setup
```
"Create an email account support@example.com for package pkg-67890"
```

### SSL Certificate Management
```
"Order an SSL certificate for example.com"
"Enable free SSL for my domain"
```

---

## 🔗 **Related Documentation**

- [Enhancement Tools (70)](Enhancement-Tools) - Advanced functionality beyond base API
- [Usage Examples](Usage-Examples) - Practical implementation examples
- [Tool Categories](Tool-Categories) - Tools organized by service type
- [API Reference](API-Reference) - Complete technical reference

---

*These 271 base API tools provide complete coverage of the official 20i API, ensuring every hosting function is accessible through AI assistants.*