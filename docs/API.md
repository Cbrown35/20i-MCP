# 20i MCP Server API Documentation

This document provides comprehensive documentation for all MCP tools provided by the 20i MCP Server.

## Authentication

The server authenticates with the 20i API using environment variables:
- `TWENTYI_API_KEY`: Your general API key
- `TWENTYI_OAUTH_KEY`: Your OAuth client key  
- `TWENTYI_COMBINED_KEY`: Your combined API key

## Available Tools

### Account Management

#### `get_reseller_info`
Retrieves comprehensive reseller account information.

**Parameters:** None

**Returns:** JSON object containing:
- Account details and limits
- Usage statistics
- Billing information
- API usage metrics

**Example Usage:**
```
"Show me my 20i account overview"
"What are my current account limits?"
"Display my reseller account statistics"
```

#### `get_account_balance`
Retrieves account balance and billing information.

**Parameters:** None

**Returns:** JSON object containing:
- Current account balance
- Billing details
- Credit information
- Payment status

**Example Usage:**
```
"What's my current account balance?"
"Show me my billing balance"
"Check how much credit I have left"
"Display my payment status and account balance"
```

### Domain Management

#### `list_domains`
Lists all domains in your reseller account.

**Parameters:** None

**Returns:** Array of domain objects with:
- Domain names
- Status information
- Expiration dates
- Configuration details

**Example Usage:**
```
"List all my domains"
"Show me domains expiring this month"
"What domains do I manage?"
```

#### `get_domain_info`
Retrieves detailed information for a specific domain.

**Parameters:**
- `domain_id` (string, required): The domain ID to query

**Returns:** Detailed domain object containing:
- Domain configuration
- DNS settings
- Security settings
- Performance metrics

**Example Usage:**
```
"Get details for domain ID 12345"
"Show me configuration for example.com"
```

#### `get_dns_records`
Retrieves DNS records for a specific domain.

**Parameters:**
- `domain_id` (string, required): The domain ID to query

**Returns:** Array of DNS records with:
- Record types (A, AAAA, CNAME, MX, TXT, etc.)
- Record names and values
- TTL settings

**Example Usage:**
```
"Show DNS records for example.com"
"List all A records for my domain"
"What are the MX records for domain ID 12345?"
```

#### `update_dns_record`
Adds or updates DNS records for a domain.

**Parameters:**
- `domain_id` (string, required): The domain ID to update
- `record_type` (string, required): DNS record type (A, AAAA, CNAME, MX, TXT, etc.)
- `name` (string, required): DNS record name/subdomain
- `value` (string, required): DNS record value
- `ttl` (number, optional): Time to live (default: 3600)

**Returns:** Confirmation of DNS record creation/update

**Example Usage:**
```
"Add an A record for blog.example.com pointing to 192.168.1.100"
"Update the CNAME record for www to point to example.com"
"Set the MX record for mail.example.com with priority 10"
```

#### `register_domain`
Registers a new domain name with full contact management.

**Parameters:**
- `name` (string, required): Domain name to register (e.g., "example.com")
- `years` (number, required): Number of years to register for
- `contact` (object, required): Contact information including name, address, city, state, postal code, country, phone, email
- `privacy_service` (boolean, optional): Enable domain privacy protection
- `nameservers` (array, optional): Custom nameservers (defaults to 20i nameservers)
- `stack_user` (string, optional): Stack user to grant access to

**Returns:** Domain registration confirmation and details

**Example Usage:**
```
"Register the domain 'mynewbusiness.com' for 2 years with privacy protection"
"Register 'clientsite.org' using my standard contact information"
"Register 'example.net' and assign it to stack user 'john_doe'"
```

#### `search_domains`
Searches for domain availability and provides domain name suggestions.

**Parameters:**
- `search_term` (string, required): Domain name or prefix to search for. Can be a full domain name (e.g., "example.com") or a prefix (e.g., "example") to search across all TLDs
- `suggestions` (boolean, optional): Enable domain name suggestions (default: false)
- `tlds` (array, optional): Specific TLDs to search (defaults to all supported TLDs)

**Returns:** Array of domain search results with:
- Domain availability status
- Pricing information
- Registration details
- Suggested alternative domains (if enabled)

**Example Usage:**
```
"Search for availability of 'mybusiness.com'"
"Check if 'example' is available across all TLDs"
"Search for 'startup' domains with suggestions enabled"
"Find available domains for 'tech' in .com, .net, and .org only"
```

**Note:** This endpoint supports both specific domain searches and prefix searches across multiple TLDs. Results may include semantic suggestions for similar domain names when suggestions are enabled.

#### `get_domain_verification_status`
Retrieves domain verification status for all domains requiring verification.

**Parameters:** None

**Returns:** Array of domains with verification information including:
- Domain names requiring verification
- Verification status and requirements
- Completion status
- Next steps for verification

**Example Usage:**
```
"Show me which domains need verification"
"Check domain verification status for my account"
"List all domains requiring registrant verification"
```

#### `resend_domain_verification_email`
Resends the domain verification email for a specific domain.

**Parameters:**
- `package_id` (string, required): The hosting package ID containing the domain
- `domain_id` (string, required): The domain ID requiring verification

**Returns:** Confirmation of email resend operation

**Example Usage:**
```
"Resend verification email for domain ID 12345 in package w67890"
"Send verification email again for my domain that needs verification"
"Resend domain verification email for example.com"
```

**Note:** This is used when domains require registrant verification as part of the registration or transfer process. Not all domains require verification.

### WordPress Management

#### `is_wordpress_installed`
Checks if WordPress is installed on a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to check

**Returns:** Boolean result indicating WordPress installation status

**Example Usage:**
```
"Check if WordPress is installed on package w12345"
"Is WordPress running on my hosting package?"
"Verify WordPress installation status for my site"
```

#### `reinstall_wordpress`
Reinstalls WordPress software on a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to reinstall WordPress on

**Returns:** Reinstallation confirmation and details

**Example Usage:**
```
"Reinstall WordPress on package w12345"
"Fresh WordPress installation for my corrupted site"
"Reset WordPress to clean state for package w67890"
```

#### `get_wordpress_settings`
Retrieves WordPress configuration settings.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get settings for

**Returns:** WordPress configuration settings and options

**Example Usage:**
```
"Show WordPress settings for package w12345"
"Get WordPress configuration for my site"
"Display all WordPress options and settings"
```

#### `set_wordpress_settings`
Updates WordPress configuration settings.

**Parameters:**
- `package_id` (string, required): The hosting package ID to set settings for
- `option_name` (string, required): WordPress option name to set
- `option_value` (string, required): WordPress option value to set

**Returns:** Setting update confirmation

**Example Usage:**
```
"Set WordPress site title to 'My Awesome Blog' for package w12345"
"Update WordPress admin email to admin@newdomain.com"
"Change WordPress timezone setting to America/New_York"
```

#### `get_wordpress_version`
Gets the current WordPress version for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get version for

**Returns:** Current WordPress version information

**Example Usage:**
```
"What WordPress version is running on package w12345?"
"Check WordPress version for my site"
"Show current WordPress version and update status"
```

#### `wordpress_search_replace`
Performs WordPress search and replace operations across the database.

**Parameters:**
- `package_id` (string, required): The hosting package ID to perform operation on
- `search` (string, required): Text to search for
- `replace` (string, required): Text to replace with

**Returns:** Search and replace operation results

**Example Usage:**
```
"Replace all instances of 'old-domain.com' with 'new-domain.com' in WordPress"
"Update WordPress site URL from staging.site.com to site.com"
"Change all references from http:// to https:// in WordPress database"
```

#### `get_wordpress_plugins`
Lists all installed WordPress plugins and their status.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get plugins for

**Returns:** Array of WordPress plugins with status information

**Example Usage:**
```
"List all WordPress plugins for package w12345"
"Show WordPress plugin status and versions"
"Which plugins are active on my WordPress site?"
```

#### `manage_wordpress_plugin`
Activates, deactivates, or removes WordPress plugins.

**Parameters:**
- `package_id` (string, required): The hosting package ID to manage plugin for
- `action` (string, required): Action to perform - 'activate', 'deactivate', or 'remove'
- `plugin_name` (string, required): Name of the plugin to manage

**Returns:** Plugin management operation confirmation

**Example Usage:**
```
"Activate the Yoast SEO plugin on package w12345"
"Deactivate all inactive plugins on my WordPress site"
"Remove the old contact form plugin from WordPress"
```

#### `install_stackcache_plugin`
Installs the StackCache performance optimization plugin.

**Parameters:**
- `package_id` (string, required): The hosting package ID to install plugin for

**Returns:** StackCache plugin installation confirmation

**Example Usage:**
```
"Install StackCache plugin for better performance on package w12345"
"Add StackCache optimization to my WordPress site"
"Enable StackCache caching for my hosting package"
```

#### `get_wordpress_themes`
Lists all installed WordPress themes.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get themes for

**Returns:** Array of WordPress themes with status information

**Example Usage:**
```
"List all WordPress themes for package w12345"
"Show available themes on my WordPress site"
"Which WordPress theme is currently active?"
```

#### `manage_wordpress_theme`
Activates, deactivates, or removes WordPress themes.

**Parameters:**
- `package_id` (string, required): The hosting package ID to manage theme for
- `action` (string, required): Action to perform - 'activate', 'deactivate', or 'remove'
- `theme_name` (string, required): Name of the theme to manage

**Returns:** Theme management operation confirmation

**Example Usage:**
```
"Activate the Twenty Twenty-Four theme on package w12345"
"Switch to the Astra theme for my WordPress site"
"Remove unused themes from my WordPress installation"
```

#### `get_wordpress_users`
Lists WordPress users and their roles.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get users for

**Returns:** Array of WordPress users with role information

**Example Usage:**
```
"List all WordPress users for package w12345"
"Show WordPress administrators and their access levels"
"Who has access to my WordPress site?"
```

#### `update_wordpress`
Updates WordPress to the latest version.

**Parameters:**
- `package_id` (string, required): The hosting package ID to update WordPress for

**Returns:** WordPress update operation confirmation

**Example Usage:**
```
"Update WordPress to the latest version on package w12345"
"Install WordPress security updates for my site"
"Upgrade WordPress core to newest version"
```

#### `get_wordpress_staging`
Checks WordPress staging environment status.

**Parameters:**
- `package_id` (string, required): The hosting package ID to check staging for

**Returns:** Staging environment status and configuration

**Example Usage:**
```
"Check staging environment status for package w12345"
"Is there a staging copy of my WordPress site?"
"Show WordPress staging configuration"
```

#### `manage_wordpress_staging`
Clones WordPress site between live and staging environments.

**Parameters:**
- `package_id` (string, required): The hosting package ID to manage staging for
- `type` (string, required): Clone direction - 'live' (copy live to staging) or 'staging' (copy staging to live)

**Returns:** Staging operation confirmation

**Example Usage:**
```
"Copy my live WordPress site to staging environment"
"Deploy staging changes to live WordPress site"
"Create staging copy of production WordPress site"
```

### CDN Management

#### `get_cdn_options`
Lists all available CDN features for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get CDN options for

**Returns:** Array of available CDN features and their configurations

**Example Usage:**
```
"Show me all available CDN features for package w12345"
"What CDN features can I enable for better performance?"
"List all CDN options for my hosting package"
```

#### `get_cdn_feature_groups`
Gets CDN feature groups for organized management.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get feature groups for

**Returns:** CDN feature groups with categorized features

**Example Usage:**
```
"Show me CDN feature groups for package w12345"
"What are the different categories of CDN features?"
"Display organized CDN feature groups"
```

#### `add_cdn_feature`
Adds a single CDN feature to a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to add feature to
- `feature_data` (object, required): CDN feature configuration data

**Returns:** Feature addition confirmation and details

**Example Usage:**
```
"Enable CDN compression feature for package w12345"
"Add image optimization CDN feature to my site"
"Activate minification CDN feature for better performance"
```

#### `bulk_add_cdn_features`
Adds multiple CDN features in a single operation.

**Parameters:**
- `package_id` (string, required): The hosting package ID to add features to
- `features_data` (object, required): Multiple CDN features configuration

**Returns:** Bulk feature addition confirmation

**Example Usage:**
```
"Enable all performance CDN features for package w12345"
"Add compression, minification, and image optimization CDN features"
"Bulk activate security and performance CDN features"
```

#### `get_cdn_stats`
Gets CDN usage statistics and performance metrics.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get CDN stats for

**Returns:** CDN usage statistics, bandwidth, and performance metrics

**Example Usage:**
```
"Show CDN statistics for package w12345"
"What's my CDN bandwidth usage this month?"
"Display CDN performance metrics and analytics"
```

#### `get_cache_report`
Gets detailed CDN cache report (requires Website Turbo).

**Parameters:**
- `package_id` (string, required): The hosting package ID to get cache report for

**Returns:** Comprehensive cache performance report

**Example Usage:**
```
"Show me cache report for package w12345"
"Get CDN cache performance analysis"
"Display cache hit rates and optimization opportunities"
```

#### `purge_cdn_cache`
Purges CDN cache for a specific URL.

**Parameters:**
- `package_id` (string, required): The hosting package ID to purge cache for
- `url` (string, required): URL to purge from CDN cache

**Returns:** Cache purge confirmation

**Example Usage:**
```
"Clear CDN cache for https://example.com/updated-page.html"
"Purge cache for my homepage after content updates"
"Force CDN cache refresh for https://mysite.com/news/latest"
```

#### `get_stackcache_settings`
Gets current StackCache performance settings.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get settings for

**Returns:** Current StackCache configuration and policies

**Example Usage:**
```
"Show StackCache settings for package w12345"
"What are my current StackCache policies?"
"Display StackCache configuration for performance optimization"
```

#### `set_stackcache_policy`
Sets StackCache policies for CSS, images, and JavaScript optimization.

**Parameters:**
- `package_id` (string, required): The hosting package ID to set policies for
- `policy_data` (object, required): StackCache policy configuration

**Returns:** Policy update confirmation

**Example Usage:**
```
"Set aggressive StackCache policy for maximum performance"
"Configure StackCache to optimize CSS and JavaScript"
"Update StackCache policies for better image compression"
```

#### `get_cdn_security_headers`
Gets current CDN security headers configuration.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get security headers for

**Returns:** Current security headers and their values

**Example Usage:**
```
"Show security headers for package w12345"
"What CDN security headers are currently active?"
"Display current security header configuration"
```

#### `update_cdn_security_headers`
Updates CDN security headers for enhanced protection.

**Parameters:**
- `package_id` (string, required): The hosting package ID to update headers for
- `headers_data` (object, required): Security headers configuration

**Returns:** Security headers update confirmation

**Example Usage:**
```
"Set strict security headers for enhanced protection"
"Update HSTS and CSP headers for package w12345"
"Configure security headers to prevent XSS attacks"
```

#### `delete_cdn_security_headers`
Deletes CDN security headers.

**Parameters:**
- `package_id` (string, required): The hosting package ID to delete headers for
- `header_names` (array, optional): Specific header names to delete

**Returns:** Header deletion confirmation

**Example Usage:**
```
"Remove all security headers for package w12345"
"Delete specific CORS header from CDN configuration"
"Clear security headers that are causing issues"
```

#### `get_cdn_traffic_distribution`
Gets CDN traffic distribution by country and region.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get traffic data for
- `filters` (object, optional): Optional filters for traffic analysis

**Returns:** Traffic distribution analytics by geographic location

**Example Usage:**
```
"Show CDN traffic distribution by country for package w12345"
"Where are most of my website visitors coming from?"
"Display geographic traffic analytics for performance optimization"
```

#### `assign_website_turbo`
Assigns a hosting package to Website Turbo service for enhanced performance.

**Parameters:**
- `website_turbo_id` (string, required): Website Turbo service ID
- `package_id` (string, required): Hosting package ID to assign

**Returns:** Website Turbo assignment confirmation

**Example Usage:**
```
"Assign package w12345 to Website Turbo for faster loading"
"Enable Website Turbo service for my hosting package"
"Connect my site to Website Turbo for performance acceleration"
```

#### `order_website_turbo_credits`
Orders Website Turbo credits for CDN and performance services.

**Parameters:**
- `amount` (number, required): Amount of Website Turbo credits to order

**Returns:** Credit order confirmation and account update

**Example Usage:**
```
"Order 100 Website Turbo credits for CDN services"
"Purchase additional Website Turbo credits for performance"
"Add more Website Turbo credits to my account"
```

### Backup/Restore Management

#### `list_timeline_storage`
Lists timeline storage items for backup management.

**Parameters:**
- `package_id` (string, required): The hosting package ID to list storage for

**Returns:** Array of timeline storage items with backup information

**Example Usage:**
```
"Show me all timeline storage items for package w12345"
"List backup storage inventory for my hosting package"
"Display available backups for data recovery planning"
```

#### `create_snapshot`
Creates immediate snapshots for web content or databases.

**Parameters:**
- `package_id` (string, required): The hosting package ID to create snapshot for
- `snapshot_type` (string, required): Type of snapshot - 'web' or 'database'
- `database_id` (string, optional): Database ID if creating database snapshot

**Returns:** Snapshot creation confirmation and details

**Example Usage:**
```
"Create a web snapshot for package w12345"
"Take a database snapshot for database db67890"
"Create immediate backup of my website and database"
```

#### `list_snapshots`
Lists available snapshots for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to list snapshots for

**Returns:** Array of available snapshots with creation dates and types

**Example Usage:**
```
"Show me all available snapshots for package w12345"
"List backup snapshots for recovery options"
"Display snapshot history for my hosting package"
```

#### `restore_snapshot`
Restores content from timeline snapshots.

**Parameters:**
- `package_id` (string, required): The hosting package ID to restore to
- `snapshot_id` (string, required): The snapshot ID to restore from
- `restore_type` (string, required): Type of restoration - 'web', 'database', or 'both'

**Returns:** Restoration confirmation and progress details

**Example Usage:**
```
"Restore my website from snapshot s12345"
"Restore database from yesterday's snapshot"
"Restore both web and database from snapshot s67890"
```

#### `get_snapshot_jobs`
Monitors snapshot job status and progress.

**Parameters:**
- `package_id` (string, required): The hosting package ID to monitor jobs for

**Returns:** Array of active and recent snapshot jobs with status

**Example Usage:**
```
"Check snapshot job status for package w12345"
"Monitor backup creation progress"
"Show me all running backup and restore jobs"
```

#### `restore_ftp_backup`
Restores backups that were uploaded via FTP.

**Parameters:**
- `package_id` (string, required): The hosting package ID to restore to
- `backup_filename` (string, required): Name of the backup file uploaded via FTP

**Returns:** FTP backup restoration confirmation and progress

**Example Usage:**
```
"Restore backup file 'mysite_backup_2024.tar.gz' for package w12345"
"Restore the FTP-uploaded backup for my hosting package"
"Process external backup file that I uploaded via FTP"
```

#### `list_backup_jobs`
Lists backup and restore job history with status.

**Parameters:**
- `package_id` (string, required): The hosting package ID to list jobs for

**Returns:** Array of backup/restore jobs with completion status and logs

**Example Usage:**
```
"Show backup job history for package w12345"
"List all completed and failed backup operations"
"Display backup job logs for troubleshooting"
```

#### `list_multisite_backups`
Lists multisite backup information for bulk operations.

**Parameters:**
- `package_ids` (array, required): Array of hosting package IDs to check

**Returns:** Multisite backup status and configuration for multiple packages

**Example Usage:**
```
"Show backup status for packages w12345, w67890, w11111"
"List backup information for all my client websites"
"Check multisite backup configuration for bulk operations"
```

#### `create_multisite_backup`
Creates backups for multiple hosting packages simultaneously.

**Parameters:**
- `package_ids` (array, required): Array of hosting package IDs to backup
- `backup_type` (string, required): Type of backup - 'web', 'database', or 'both'

**Returns:** Multisite backup creation confirmation for all packages

**Example Usage:**
```
"Create web backups for packages w12345, w67890, w11111"
"Backup all databases for my client hosting packages"
"Create full backups for all specified hosting packages"
```

#### `list_vps_backups`
Lists VPS backup services and configurations.

**Parameters:**
- `vps_id` (string, required): The VPS ID to list backup services for

**Returns:** Array of VPS backup services with configuration details

**Example Usage:**
```
"Show VPS backup services for server vps123"
"List backup configuration for my VPS infrastructure"
"Display VPS data protection services"
```

#### `update_vps_backup`
Configures VPS backup service settings.

**Parameters:**
- `vps_id` (string, required): The VPS ID to configure backups for
- `backup_config` (object, required): VPS backup configuration settings

**Returns:** VPS backup configuration update confirmation

**Example Usage:**
```
"Configure daily VPS backups for server vps123"
"Update VPS backup retention policy to 30 days"
"Set up automated VPS backup schedule"
```

### Advanced Security Management

#### `get_blocked_ip_addresses`
Retrieves blocked IP addresses for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get blocked IPs for

**Returns:** Array of blocked IP addresses (standard format or CIDR)

**Example Usage:**
```
"Show me all blocked IP addresses for package w12345"
"List current IP blocks for security review"
"Display IP access restrictions for my hosting package"
```

#### `set_blocked_ip_addresses`
Sets blocked IP addresses for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to set blocked IPs for
- `ip_addresses` (array, optional): Array of IP addresses or CIDR ranges to block

**Returns:** IP blocking configuration confirmation

**Example Usage:**
```
"Block IPs 192.168.1.100, 10.0.0.0/8 for package w12345"
"Set comprehensive IP block list for enhanced security"
"Clear all IP blocks by setting empty list"
```

#### `add_ip_block`
Adds a single IP address to the block list.

**Parameters:**
- `package_id` (string, required): The hosting package ID to add IP block to
- `ip_address` (string, required): IP address or CIDR range to block

**Returns:** IP block addition confirmation

**Example Usage:**
```
"Block IP address 203.0.113.5 for package w12345"
"Add 172.16.0.0/16 to IP block list for internal network protection"
"Block suspicious IP 198.51.100.42 immediately"
```

#### `remove_ip_block`
Removes an IP address from the block list.

**Parameters:**
- `package_id` (string, required): The hosting package ID to remove IP block from
- `ip_address` (string, required): IP address or CIDR range to unblock

**Returns:** IP block removal confirmation

**Example Usage:**
```
"Remove IP block for 203.0.113.5 to restore legitimate access"
"Unblock 10.0.0.0/8 for internal network access"
"Remove false positive IP block for 198.51.100.42"
```

#### `get_blocked_countries`
Retrieves blocked countries for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get blocked countries for

**Returns:** Array of blocked country codes (ISO 3166 format)

**Example Usage:**
```
"Show me all blocked countries for package w12345"
"List current geographic restrictions for security review"
"Display country-based access controls"
```

#### `set_blocked_countries`
Sets blocked countries for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to set blocked countries for
- `countries` (array, required): Array of ISO 3166 country codes to block
- `access` (string, optional): Access type configuration (default: "block")

**Returns:** Country blocking configuration confirmation

**Example Usage:**
```
"Block countries CN, RU, KP for package w12345"
"Set comprehensive country block list for compliance"
"Block high-risk countries for enhanced security"
```

#### `add_country_block`
Adds a single country to the block list.

**Parameters:**
- `package_id` (string, required): The hosting package ID to add country block to
- `country_code` (string, required): ISO 3166 country code to block (e.g., "CN", "RU")
- `access` (string, optional): Access type configuration (default: "block")

**Returns:** Country block addition confirmation

**Example Usage:**
```
"Block traffic from China (CN) for package w12345"
"Add Russia (RU) to country block list for security"
"Block North Korea (KP) for compliance requirements"
```

#### `remove_country_block`
Removes a country from the block list.

**Parameters:**
- `package_id` (string, required): The hosting package ID to remove country block from
- `country_code` (string, required): ISO 3166 country code to unblock

**Returns:** Country block removal confirmation

**Example Usage:**
```
"Remove country block for Germany (DE) to allow EU traffic"
"Unblock Canada (CA) for North American access"
"Remove false positive country block for UK (GB)"
```

#### `get_malware_scan`
Gets malware scan status and results for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get malware scan for

**Returns:** Malware scan status, results, and threat information

**Example Usage:**
```
"Check malware scan status for package w12345"
"Show me the latest security scan results"
"Display threat detection status for my hosting package"
```

#### `request_malware_scan`
Requests a new malware scan for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to scan for malware

**Returns:** Malware scan initiation confirmation

**Example Usage:**
```
"Run a new malware scan on package w12345"
"Start security scan to check for threats"
"Initiate malware detection for my hosting package"
```

#### `get_malware_report`
Gets detailed malware report for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to get malware report for

**Returns:** Detailed malware analysis and threat assessment

**Example Usage:**
```
"Show me detailed malware report for package w12345"
"Get comprehensive security analysis for threat investigation"
"Display malware detection details and recommendations"
```

#### `get_email_spam_blacklist`
Gets email spam blacklist configuration.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Current email spam blacklist settings and blocked addresses

**Example Usage:**
```
"Show email spam blacklist for support@mysite.com"
"Display blocked email addresses for security review"
"Get spam filter blacklist configuration"
```

#### `get_email_spam_whitelist`
Gets email spam whitelist configuration.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Current email spam whitelist settings and allowed addresses

**Example Usage:**
```
"Show email spam whitelist for support@mysite.com"
"Display allowed email addresses for legitimate senders"
"Get spam filter whitelist configuration"
```

#### `add_tls_certificate`
Orders a premium TLS/SSL certificate.

**Parameters:**
- `name` (string, required): Certificate name/identifier
- `period_months` (number, required): Certificate validity period in months
- `configuration` (object, required): Certificate configuration details

**Returns:** Premium SSL certificate order confirmation and details

**Example Usage:**
```
"Order premium SSL certificate for mysite.com valid for 12 months"
"Purchase commercial SSL certificate with extended validation"
"Order wildcard SSL certificate for *.mysite.com domain"
```

#### `renew_tls_certificate`
Renews an existing TLS/SSL certificate.

**Parameters:**
- `certificate_id` (string, required): Certificate ID to renew
- `period_months` (number, required): Renewal period in months

**Returns:** SSL certificate renewal confirmation and updated details

**Example Usage:**
```
"Renew SSL certificate cert123 for another 12 months"
"Extend premium SSL certificate before expiration"
"Renew commercial SSL certificate with 24-month validity"
```

### Hosting Package Management

#### `list_hosting_packages`
Lists all hosting packages in your reseller account.

**Parameters:** None

**Returns:** Array of hosting package objects with:
- Package names and types
- Resource usage and limits
- Status information
- Performance metrics

**Example Usage:**
```
"List all my hosting packages"
"Show hosting packages using over 80% resources"
"What WordPress hosting packages do I have?"
```

#### `get_hosting_package_info`
Retrieves detailed information for a specific hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID to query

**Returns:** Detailed package object containing:
- Resource usage and limits
- Configuration settings
- Performance metrics
- Security status

**Example Usage:**
```
"Get details for hosting package 67890"
"Show performance metrics for my main hosting package"
```

#### `create_hosting_package`
Creates a new hosting package with specified configuration.

**Parameters:**
- `domain_name` (string, required): Domain name for the hosting package
- `package_type` (string, required): Type of hosting package (e.g., "shared", "reseller")
- `username` (string, required): Username for the hosting account
- `password` (string, required): Password for the hosting account

**Returns:** New hosting package details and configuration

**Example Usage:**
```
"Create a WordPress hosting package for newclient.com"
"Set up shared hosting for example.org with username 'example_user'"
```

### Cloud Server Management

#### `list_cloud_servers`
Lists all cloud servers in your reseller account.

**Parameters:** None

**Returns:** Array of cloud server objects with:
- Server names and IDs
- Resource specifications
- Status and health information
- Performance metrics

**Example Usage:**
```
"List all my cloud servers"
"Show cloud servers in the London region"
"What's the status of my production servers?"
```

#### `create_cloud_server`
Creates a new cloud server with specified configuration.

**Parameters:**
- `provider` (string, required): Cloud provider (e.g., "aws", "digitalocean")
- `size` (string, required): Server size/specification
- `location` (string, required): Server location/region
- `name` (string, required): Name for the cloud server

**Returns:** New cloud server details and configuration

**Example Usage:**
```
"Create a 4GB cloud server in London for development"
"Deploy a production server on AWS in the US East region"
"Set up a staging server with 2GB RAM in Germany"
```

## Error Handling

All tools implement comprehensive error handling:

- **Authentication Errors**: Invalid or expired API credentials
- **Rate Limiting**: API request limits exceeded
- **Validation Errors**: Invalid parameters or missing required fields
- **Network Errors**: Connection issues with 20i API
- **Server Errors**: Internal server errors from 20i

Error responses include:
- Clear error messages
- Suggested resolution steps
- Relevant error codes
- Context information

## Rate Limits

The server respects 20i API rate limits:
- Automatic retry with exponential backoff
- Request queuing for high-volume operations
- Rate limit status monitoring

## Security Features

- Secure credential handling via environment variables
- Input validation and sanitization
- No logging of sensitive information
- Encrypted API communications
- Token refresh handling

## Integration Examples

### Claude Desktop Integration
```json
{
  "mcpServers": {
    "20i-hosting": {
      "command": "node",
      "args": ["/path/to/20i-MCP/build/index.js"],
      "cwd": "/path/to/20i-MCP",
      "env": {
        "TWENTYI_API_KEY": "your_api_key",
        "TWENTYI_OAUTH_KEY": "your_oauth_key",
        "TWENTYI_COMBINED_KEY": "your_combined_key"
      }
    }
  }
}
```

### VS Code Integration
Configure in your VS Code settings or workspace configuration following the same pattern as Claude Desktop.

## Advanced Usage

### Batch Operations
Many tools can be used in sequence for batch operations:

```
"List all domains, then show DNS records for each domain expiring in 30 days"
"Create hosting packages for these three domains: site1.com, site2.com, site3.com"
```

### Monitoring and Alerting
Use tools for proactive monitoring:

```
"Check resource usage across all hosting packages and alert if any exceed 90%"
"Monitor DNS propagation for recently updated records"
```

### Automation Workflows
Chain tools together for complex workflows:

```
"Create a hosting package for newsite.com, then set up DNS records pointing to the server"
"Deploy a cloud server, create a hosting package, and configure the domain"
```

## Support and Troubleshooting

For issues with the MCP server:
1. Check authentication credentials
2. Verify 20i API access and permissions
3. Review server logs for detailed error information
4. Consult the troubleshooting section in README.md

For 20i API-specific issues:
- Consult the official 20i API documentation
- Contact 20i support for account-related issues
- Check API status and maintenance notifications

### Premium Email Services

#### `order_premium_mailbox`
Orders a premium mailbox service from 20i.

**Parameters:**
- `mailbox_id` (string, required): The mailbox ID (e.g., "m11111")
- `local` (string, required): The local part before @ symbol
- `domain` (string, required): The domain part after @ symbol
- `for_user` (string, optional): Optional user to assign mailbox to

**Returns:** Order confirmation and mailbox details

**Example Usage:**
```
"Order a premium mailbox for support@example.com"
"Set up premium email for admin@clientsite.com"
"Create a premium mailbox m12345 for sales@newdomain.com"
```

#### `renew_premium_mailbox`
Renews an existing premium mailbox subscription.

**Parameters:**
- `id` (string, required): The premium mailbox ID to renew

**Returns:** Renewal confirmation and updated subscription details

**Example Usage:**
```
"Renew premium mailbox subscription for ID pm67890"
"Extend the premium email service for admin@example.com"
```

#### `generate_webmail_url`
Generates a single sign-on URL for webmail access.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID
- `mailbox_id` (string, required): The mailbox ID

**Returns:** Single sign-on webmail URL

**Example Usage:**
```
"Generate webmail login for user@example.com"
"Create SSO webmail link for support mailbox"
```

### Email Configuration Management

#### `get_email_configuration`
Retrieves email configuration for a domain in a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Email domain configuration including:
- Domain settings
- MX records configuration
- Email routing settings
- Security settings

**Example Usage:**
```
"Show email configuration for example.com"
"Get email settings for package w12345 and domain d67890"
```

#### `get_mailbox_configuration`
Retrieves mailbox configuration and settings.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Mailbox configuration including:
- Mailbox quotas and limits
- User account settings
- Storage usage
- Security preferences

**Example Usage:**
```
"Show mailbox settings for example.com"
"Get mailbox quotas for all users on clientsite.com"
```

#### `get_email_forwarders`
Retrieves email forwarders for a specific email domain.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** Array of email forwarders with:
- Source email addresses
- Destination addresses
- Forwarding rules
- Status information

**Example Usage:**
```
"List email forwarders for example.com"
"Show forwarding rules for support@clientsite.com"
```

#### `get_all_email_forwarders`
Retrieves all email forwarders for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Complete list of all email forwarders across all domains in the package

**Example Usage:**
```
"Show all email forwarders for hosting package w12345"
"List every email forwarding rule in my hosting account"
```

### Email Security Management

#### `get_dkim_signature`
Retrieves DKIM signature configuration for a domain's email.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** DKIM signature configuration including:
- Current DKIM selector and key information
- Signature settings and canonicalization
- Configuration status and validity

**Example Usage:**
```
"Show DKIM signature for example.com email domain"
"Get DKIM configuration for package w12345 and email domain e67890"
"Check current DKIM authentication settings"
```

#### `set_dkim_signature`
Sets or deletes DKIM signature for email authentication.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID
- `action` (string, required): Action to perform - 'set' or 'delete'
- `canonicalization` (string, optional): DKIM canonicalization method
- `selector` (string, optional): DKIM selector name
- `is_default` (boolean, optional): Set as default DKIM signature
- `note` (string, optional): Note for DKIM configuration

**Returns:** DKIM signature configuration confirmation

**Example Usage:**
```
"Set up DKIM signature for example.com with selector 'mail'"
"Enable DKIM authentication for my email domain"
"Delete DKIM signature for package w12345 email domain e67890"
"Configure DKIM with strict canonicalization for better security"
```

**Note:** DKIM (DomainKeys Identified Mail) is essential for email deliverability and anti-spoofing protection.

#### `get_dmarc_policy`
Retrieves DMARC policy configuration for a domain's email.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID

**Returns:** DMARC policy configuration including:
- Current policy action (none, quarantine, reject)
- Subdomain policy settings
- Reporting configuration and URIs
- Alignment modes and percentage settings

**Example Usage:**
```
"Show DMARC policy for example.com email domain"
"Get DMARC configuration and reporting settings"
"Check current DMARC policy enforcement level"
```

#### `set_dmarc_policy`
Sets or deletes DMARC policy for email authentication and security.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID
- `action` (string, required): Action to perform - 'set' or 'delete'
- `policy` (string, required when action=set): DMARC policy - 'none', 'quarantine', or 'reject'
- `subdomain_policy` (string, optional): Policy for subdomains
- `percentage` (number, optional): Percentage of emails to apply policy to (0-100)
- `reporting_uri` (string, optional): URI for aggregate reports
- `alignment_mode` (string, optional): Alignment mode - 'strict' or 'relaxed'
- `note` (string, optional): Note for DMARC configuration

**Returns:** DMARC policy configuration confirmation

**Example Usage:**
```
"Set DMARC policy to 'quarantine' for enhanced email security"
"Configure DMARC with 50% enforcement and reporting to security@example.com"
"Enable strict DMARC policy with reject action for maximum protection"
"Delete DMARC policy for package w12345 email domain e67890"
"Set up DMARC monitoring with 'none' policy for testing"
```

**Note:** DMARC (Domain-based Message Authentication, Reporting & Conformance) works with SPF and DKIM to prevent email spoofing and improve deliverability.

### PHP Environment Management

#### `get_available_php_versions`
Get all available PHP versions for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** List of available PHP versions with:
- Version numbers and display titles
- Compatibility information
- Feature support details

**Example Usage:**
```
"Show available PHP versions for my hosting package"
"What PHP versions can I use for package w12345?"
"List supported PHP versions for application deployment"
```

#### `get_current_php_version`
Get the currently active PHP version for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Current PHP version information including:
- Active version number
- Configuration details
- Performance settings

**Example Usage:**
```
"What PHP version is currently active?"
"Check current PHP version for package w12345"
"Show me the active PHP configuration"
```

#### `set_php_version`
Set the PHP version for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `version` (string, required): PHP version to set (e.g., "8.2", "7.4")

**Returns:** PHP version change confirmation

**Example Usage:**
```
"Set PHP version to 8.2 for my hosting package"
"Upgrade PHP to version 8.1 for package w12345"
"Switch to PHP 7.4 for compatibility with legacy application"
```

**Note:** PHP version changes may require application restart and cache clearing. Ensure compatibility before switching versions.

#### `get_allowed_php_configuration`
Get configurable PHP directives for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** List of configurable PHP directives with:
- Directive names and types
- Default values and limits
- Configuration constraints

**Example Usage:**
```
"Show PHP configuration options for my package"
"What PHP settings can I customize?"
"List configurable PHP directives for optimization"
```

#### `get_php_config`
Get current PHP configuration for a specific configuration ID.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `php_config_id` (string, required): The PHP configuration ID

**Returns:** Current PHP configuration including:
- Custom directive values
- Active overrides and settings
- Configuration status

**Example Usage:**
```
"Show PHP configuration for config ID c12345"
"Get current PHP settings for my application"
"Check PHP directive values for optimization"
```

#### `update_php_config`
Update PHP configuration directives for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `php_config_id` (string, required): The PHP configuration ID
- `config` (object, required): PHP directive key-value pairs to update

**Returns:** PHP configuration update confirmation

**Example Usage:**
```
"Update PHP memory limit to 512M"
"Set max execution time to 300 seconds"
"Configure PHP upload limits for large files"
"Update PHP timezone to America/New_York"
```

**Note:** Configuration changes may take time to propagate and could affect application performance.

### File Permission Management

#### `get_file_permission_recommendations`
Get file permissions that don't match platform security recommendations.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Permission check information including:
- Files with incorrect permissions
- Recommended security settings
- Platform compliance status

**Example Usage:**
```
"Check file permissions for security compliance"
"Show files with incorrect permissions"
"Audit file security for package w12345"
"Get security recommendations for my website files"
```

#### `set_file_permissions`
Set file permissions for specific files to match security recommendations.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `permission_check_id` (number, required): Check ID from recommendations
- `files` (array, required): Array of file objects with:
  - `file` (string): File path
  - `perms` (number): Permission value (e.g., 644, 755)

**Returns:** File permission update confirmation

**Example Usage:**
```
"Fix file permissions for security compliance"
"Set recommended permissions for all flagged files"
"Update file permissions to 644 for web files"
"Apply security permissions for public_html directory"
```

**Note:** Incorrect file permissions can create security vulnerabilities. Always use recommended values.

#### `get_directory_indexing_status`
Get directory indexing configuration for security control.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Directory indexing status including:
- Current indexing state
- Security implications
- Access control settings

**Example Usage:**
```
"Check if directory indexing is enabled"
"Show directory browsing status for security audit"
"Get directory indexing configuration"
```

#### `set_directory_indexing`
Enable or disable directory indexing for security.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `enabled` (boolean, required): Whether to enable directory indexing

**Returns:** Directory indexing update confirmation

**Example Usage:**
```
"Disable directory indexing for security"
"Enable directory browsing for development"
"Turn off directory listing to prevent file exposure"
```

**Note:** Disabling directory indexing prevents visitors from viewing file lists in directories without index files.

#### `set_directory_index`
Set directory index files for htaccess configuration.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `index_files` (array, required): Array of index file names (max 5)

**Returns:** Directory index configuration confirmation

**Example Usage:**
```
"Set index.html as default directory file"
"Configure index.php and index.html as directory defaults"
"Set custom directory index files for application"
```

### Easy Builder & Website Builder Management

#### `get_easy_builder_instances`
Get current Easy Builder instances for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Easy Builder instances with:
- Instance IDs and status
- Configuration details
- Deployment information

**Example Usage:**
```
"Show Easy Builder instances for my package"
"List website builder deployments"
"Check Easy Builder instance status"
```

#### `install_easy_builder_instance`
Install an Easy Builder instance to deploy website builder.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `instance_id` (string, required): Easy Builder instance ID to install

**Returns:** Installation confirmation and status

**Example Usage:**
```
"Install Easy Builder instance eb12345"
"Deploy website builder to my hosting package"
"Set up Easy Builder for website creation"
```

#### `delete_easy_builder_instance`
Delete an Easy Builder instance and remove website builder.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `instance_id` (string, required): Easy Builder instance ID to delete

**Returns:** Deletion confirmation

**Example Usage:**
```
"Delete Easy Builder instance eb12345"
"Remove website builder from hosting package"
"Uninstall Easy Builder deployment"
```

**Note:** This operation is irreversible and will remove all website builder configuration and files.

#### `get_easy_builder_sso`
Get Easy Builder Single Sign-On URL for direct access.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `instance_id` (string, required): Easy Builder instance ID

**Returns:** SSO URL for Easy Builder interface

**Example Usage:**
```
"Get Easy Builder login URL for instance eb12345"
"Generate SSO link for website builder access"
"Create direct access link to Easy Builder interface"
```

#### `get_easy_builder_themes`
Get all available Easy Builder themes and templates.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Available themes with:
- Theme names and categories
- Preview information
- Feature descriptions

**Example Usage:**
```
"Show available Easy Builder themes"
"List website builder templates"
"Get theme options for Easy Builder"
```

#### `set_easy_builder_theme`
Apply a theme to an Easy Builder instance.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `instance_id` (string, required): Easy Builder instance ID
- `theme_name` (string, required): Theme name to apply

**Returns:** Theme application confirmation

**Example Usage:**
```
"Apply 'Modern Business' theme to Easy Builder"
"Set theme 'Creative Portfolio' for website builder"
"Change Easy Builder theme to 'E-commerce Pro'"
```

#### `get_website_builder_sso`
Get Website Builder Single Sign-On URL for traditional builder access.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** SSO URL for Website Builder interface

**Example Usage:**
```
"Get Website Builder login URL"
"Generate SSO link for traditional website builder"
"Create direct access to Website Builder interface"
```

### Enhanced Monitoring and Logging

#### `get_access_and_error_logs`
Get access and error logs for website monitoring and troubleshooting.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Combined log data including:
- Access log entries with visitor information
- Error log entries with application issues
- Request details and response codes

**Example Usage:**
```
"Show access and error logs for my website"
"Get log files for troubleshooting issues"
"Review visitor activity and application errors"
"Check logs for security incidents"
```

**Note:** Log access may be restricted based on package permissions. Logs are essential for debugging and security analysis.

#### `request_disk_usage_report`
Request a detailed disk usage analysis report for storage optimization.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `subdirectory` (string, required): Directory to analyze (e.g., "public_html", "logs")

**Returns:** Report request confirmation with:
- Report ID for later retrieval
- Analysis status
- Estimated completion time

**Example Usage:**
```
"Analyze disk usage for public_html directory"
"Request storage report for logs folder"
"Check disk space usage for email directory"
"Generate storage analysis for optimization"
```

#### `get_disk_usage_report`
Get completed disk usage report with detailed breakdown.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `report_id` (string, required): Report ID from request_disk_usage_report

**Returns:** Detailed disk usage report including:
- File and directory space consumption
- Largest files and directories
- Storage optimization recommendations

**Example Usage:**
```
"Get disk usage report r12345"
"Show storage analysis results"
"Review disk space breakdown for cleanup"
"Check completed storage optimization report"
```

#### `get_email_stats`
Get email mailbox statistics and folder information.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email_id` (string, required): The email domain ID
- `mailbox_id` (string, required): The mailbox ID

**Returns:** Mailbox statistics including:
- Storage usage by folder
- Message counts and sizes
- Quota information

**Example Usage:**
```
"Show email storage stats for mailbox m12345"
"Get mailbox statistics for optimization"
"Check email folder sizes and message counts"
"Review email storage usage for quota management"
```

#### `get_malware_scan_objects`
Get malware scan configuration and scan history.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Malware scan information including:
- Scan configuration settings
- Scan history and results
- Security monitoring status

**Example Usage:**
```
"Show malware scan configuration"
"Get security scan history and settings"
"Check malware monitoring setup"
"Review security scan objects for website protection"
```

### Database Management

#### `get_mysql_databases`
Retrieves MySQL databases for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of MySQL databases with configuration details

**Example Usage:**
```
"Show MySQL databases for package w12345"
"List all databases for my hosting package"
```

#### `get_mysql_users`
Retrieves MySQL users for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of MySQL users and their permissions

**Example Usage:**
```
"Show MySQL users for package w12345"
"List database users and their access levels"
```

#### `get_mssql_databases`
Retrieves MSSQL databases for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of MSSQL databases with configuration details

**Example Usage:**
```
"Show MSSQL databases for Windows hosting package"
"List SQL Server databases for package w12345"
```

### SSL Certificate Management

#### `get_ssl_certificates`
Retrieves SSL certificates for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of SSL certificates with status and expiration information

**Example Usage:**
```
"Show SSL certificates for package w12345"
"Check SSL certificate status for my domains"
```

#### `add_free_ssl`
Adds free SSL certificates for specified domains.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `domains` (array, required): Array of domain names for SSL certificate

**Returns:** SSL certificate creation confirmation

**Example Usage:**
```
"Add free SSL for example.com and www.example.com"
"Enable SSL certificates for my domains"
```

#### `get_force_ssl`
Gets Force HTTPS/SSL status for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Force HTTPS configuration status

**Example Usage:**
```
"Check if Force HTTPS is enabled for package w12345"
"Show SSL redirect settings for my hosting package"
```

#### `set_force_ssl`
Enables or disables Force HTTPS/SSL for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `enabled` (boolean, required): Whether to enable or disable Force HTTPS

**Returns:** Force HTTPS configuration update confirmation

**Example Usage:**
```
"Enable Force HTTPS for package w12345"
"Disable SSL redirect for my hosting package"
```

### Statistics and Monitoring

#### `get_bandwidth_stats`
Retrieves bandwidth statistics for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Bandwidth usage statistics and historical data

**Example Usage:**
```
"Show bandwidth usage for package w12345"
"Get traffic statistics for my hosting package"
```

#### `get_disk_usage`
Retrieves disk usage statistics for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Disk usage breakdown and storage statistics

**Example Usage:**
```
"Show disk usage for package w12345"
"Check storage consumption for my hosting package"
```

#### `get_access_logs`
Retrieves access logs for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Web server access logs and traffic data

**Example Usage:**
```
"Show access logs for package w12345"
"Get visitor logs for my hosting package"
```

### VPS Management

#### `list_vps`
Lists all VPS servers in your account.

**Parameters:** None

**Returns:** Array of VPS servers with status and configuration

**Example Usage:**
```
"List all my VPS servers"
"Show VPS infrastructure overview"
```

#### `get_vps_info`
Retrieves detailed information for a specific VPS server.

**Parameters:**
- `vps_id` (string, required): The VPS ID to query

**Returns:** Detailed VPS configuration and status information

**Example Usage:**
```
"Get details for VPS server vps123"
"Show configuration for my production VPS"
```

#### `list_managed_vps`
Lists all managed VPS servers in your account.

**Parameters:** None

**Returns:** Array of managed VPS servers with management status

**Example Usage:**
```
"List all my managed VPS servers"
"Show managed infrastructure overview"
```

#### `get_managed_vps_info`
Retrieves detailed information for a specific managed VPS server.

**Parameters:**
- `managed_vps_id` (string, required): The managed VPS ID to query

**Returns:** Detailed managed VPS configuration and management status

**Example Usage:**
```
"Get details for managed VPS mvps456"
"Show management status for my VPS server"
```

### Enhanced Hosting Package Tools

#### `get_hosting_package_web_info`
Retrieves web-specific hosting package information.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Web hosting specific configuration and settings

**Example Usage:**
```
"Get web hosting details for package w12345"
"Show web server configuration for my hosting package"
```

#### `get_hosting_package_limits`
Retrieves hosting package limits and quotas.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Package limits, quotas, and resource restrictions

**Example Usage:**
```
"Show resource limits for package w12345"
"Check quotas and restrictions for my hosting package"
```

#### `get_hosting_package_usage`
Retrieves hosting package usage statistics.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Current usage statistics and resource consumption

**Example Usage:**
```
"Show usage statistics for package w12345"
"Check resource consumption for my hosting package"
```

### Subdomain Management

#### `create_subdomain`
Creates a subdomain for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `subdomain` (string, required): The subdomain name to create

**Returns:** Subdomain creation confirmation with configuration details

**Example Usage:**
```
"Create subdomain 'blog' for package w12345"
"Add subdomain 'shop.mysite' to my hosting package"
"Set up subdomain 'api' for my application"
```

#### `remove_subdomain`
Removes a subdomain from a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `subdomain` (string, required): The subdomain name to remove

**Returns:** Subdomain removal confirmation

**Example Usage:**
```
"Remove subdomain 'old-blog' from package w12345"
"Delete the 'test' subdomain from my hosting package"
```

#### `list_subdomains`
Lists all subdomains for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of subdomains with configuration details

**Example Usage:**
```
"List all subdomains for package w12345"
"Show me all subdomains for my hosting account"
```

### Enhanced MySQL Management

#### `create_mysql_database`
Creates a MySQL database for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `name` (string, required): The database name

**Returns:** Database creation confirmation with connection details

**Example Usage:**
```
"Create MySQL database 'blog_db' for package w12345"
"Add database 'ecommerce' to my hosting package"
"Set up database 'analytics_data' for my application"
```

#### `create_mysql_user`
Creates a MySQL user for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `username` (string, required): The username for the MySQL user
- `password` (string, required): The password for the MySQL user

**Returns:** MySQL user creation confirmation with access details

**Example Usage:**
```
"Create MySQL user 'blog_user' with password 'secure123' for package w12345"
"Add database user 'app_reader' for my hosting package"
```

### Enhanced Email Management

#### `create_email_account`
Creates an email account for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `email` (string, required): The email address to create
- `password` (string, required): The password for the email account

**Returns:** Email account creation confirmation with configuration details

**Example Usage:**
```
"Create email account 'support@example.com' for package w12345"
"Add email 'sales@mysite.com' with password 'securePass123'"
"Set up email account 'info@clientsite.org'"
```

#### `create_email_forwarder`
Creates an email forwarder for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `source` (string, required): The source email address
- `destinations` (array, required): Array of destination email addresses

**Returns:** Email forwarder creation confirmation

**Example Usage:**
```
"Forward emails from 'contact@example.com' to 'support@company.com'"
"Create forwarder from 'sales@mysite.com' to multiple addresses"
"Set up email forwarding from 'info@site.com' to Gmail"
```

### PHP Version Management

#### `get_php_versions`
Gets available PHP versions for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of available PHP versions with compatibility information

**Example Usage:**
```
"Show available PHP versions for package w12345"
"What PHP versions can I use for my hosting package?"
"List supported PHP versions for my website"
```

#### `set_php_version`
Sets the PHP version for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `version` (string, required): The PHP version to set (e.g., "8.1", "8.2")

**Returns:** PHP version update confirmation

**Example Usage:**
```
"Set PHP version to 8.2 for package w12345"
"Upgrade PHP to version 8.1 for my hosting package"
"Change PHP version to 7.4 for compatibility"
```

### Application Management

#### `list_applications`
Lists available applications for installation.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of available applications with installation options

**Example Usage:**
```
"Show available applications for package w12345"
"What applications can I install on my hosting package?"
"List one-click install options for WordPress and others"
```

#### `install_application`
Installs an application on a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `application_id` (string, required): The application ID to install
- `path` (string, required): The installation path
- `config` (object, optional): Optional configuration parameters for the application

**Returns:** Application installation confirmation with access details

**Example Usage:**
```
"Install WordPress at '/blog' for package w12345"
"Set up Joomla in the root directory of my hosting package"
"Install Drupal at '/cms' with custom database settings"
```

### FTP and Directory Management

#### `create_ftp_user`
Creates an FTP user for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `username` (string, required): The FTP username
- `password` (string, required): The FTP password
- `path` (string, optional): The FTP access path (defaults to root)

**Returns:** FTP user creation confirmation with connection details

**Example Usage:**
```
"Create FTP user 'client_ftp' for package w12345"
"Add FTP user 'designer' with access to '/public_html/design'"
"Set up FTP account 'backup_user' for my hosting package"
```

#### `list_ftp_users`
Lists all FTP users for a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID

**Returns:** Array of FTP users with access permissions and paths

**Example Usage:**
```
"List all FTP users for package w12345"
"Show FTP accounts for my hosting package"
"Display FTP user permissions and access levels"
```

#### `manage_directories`
Creates or deletes directories in a hosting package.

**Parameters:**
- `package_id` (string, required): The hosting package ID
- `action` (string, required): The action to perform ('create' or 'delete')
- `path` (string, required): The directory path

**Returns:** Directory operation confirmation

**Example Usage:**
```
"Create directory '/public_html/uploads' for package w12345"
"Delete directory '/old_backups' from my hosting package"
"Make new folder '/assets/images' in my web directory"
```

## Real-World Usage Examples

### Complete Website Setup
```
"Create hosting package for newclient.com, then set up WordPress, create MySQL database, and add SSL certificate"
```

### Email System Setup
```
"Create email accounts for support@, sales@, and info@ for my domain, then set up forwarding to my Gmail"
```

### Development Environment
```
"Set PHP version to 8.2, create staging subdomain, install WordPress, and create FTP user for developer access"
```

### Site Migration
```
"Create MySQL database and user, set up FTP access, create subdomain for testing, then install application"
```

### Security Hardening
```
"Enable Force HTTPS, add free SSL certificates, check current PHP version, and review FTP user permissions"
```

---

*This API documentation is continuously updated to reflect new features and improvements.*