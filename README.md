[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/cbrown35-20i-mcp-badge.png)](https://mseep.ai/app/cbrown35-20i-mcp)

# 20i MCP Server 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![20i API](https://img.shields.io/badge/20i-API%20Integration-blue)](https://20i.com)

> **The first and only Model Context Protocol (MCP) server for 20i web hosting services** 

Transform your 20i hosting management experience with AI-powered administration. This groundbreaking MCP server enables natural language interactions with your 20i hosting infrastructure through Claude, ChatGPT, and other AI assistants.

## 🆕 What's New - v1.6.0 COMPREHENSIVE RELEASE

**🎉 MILESTONE RELEASE: Near-Complete API Coverage Achieved!**

- **🏆 COMPREHENSIVE COVERAGE**: 303 specialized tools covering 90.0% of 20i API functionality (303/335 endpoints)
- **🖥️ VPS Management**: Complete server infrastructure control (22 endpoints)
- **🗄️ Database Services**: Full MSSQL management with backup/restore (16 tools)
- **🔒 SSL Automation**: Complete certificate lifecycle management (11 tools)
- **📦 Package Administration**: Full service provisioning control (9 tools)
- **📧 Advanced Email**: Premium email services with DKIM/DMARC (15 tools)
- **🛡️ Security & Monitoring**: Enhanced protection and compliance (10 tools)
- **🌐 DNS & Domain Advanced**: Enterprise DNS capabilities (20 tools)
- **💾 Backup & Recovery**: Comprehensive data protection (10 tools)
- **⚙️ Platform Tools**: Windows/IIS and automation (12 tools)

The MCP server now supports **303 comprehensive tools** including:
- **🌐 Subdomain Management**: Create, remove, and list subdomains with simple commands
- **🗄️ Database Operations**: Create MySQL databases and users for your applications  
- **📧 Email Account Creation**: Set up email accounts and forwarders directly
- **⚙️ PHP Version Control**: Get and set PHP versions for optimal compatibility
- **🚀 Application Installation**: Install WordPress, Joomla, and other applications instantly
- **📁 FTP & File Management**: Create FTP users and manage directory structures
- **⚡ WordPress Management**: Complete WordPress automation, plugin/theme control, staging environments
- **🚀 CDN Management**: Content delivery optimization, cache control, security headers
- **💾 Backup/Restore Management**: Timeline snapshots, data protection, multisite backups
- **🔒 Advanced Security Management**: IP/country blocking, malware scanning, premium SSL certificates

## 🎯 Why This Matters

**For 20i Customers:**
- Manage hosting services through natural language conversations
- Reduce complex API interactions to simple chat commands
- Streamline domain, hosting, and DNS management workflows
- Enable non-technical users to perform advanced hosting operations

**For 20i:**
- First-to-market AI integration in the hosting industry
- Differentiate from competitors with cutting-edge AI capabilities
- Reduce support burden through self-service AI assistance
- Attract tech-savvy customers and developers

## ✨ Features

### 🏢 **Reseller Account Management**
- Real-time account overview and statistics
- Monitor usage, limits, and billing information
- Track performance metrics across your infrastructure

### 🌐 **Domain Management**
- List and search all domains in your portfolio
- Get detailed domain information and status
- Monitor expiration dates and renewal requirements
- Automated domain health checks

### 🖥️ **Hosting Package Administration**
- Create hosting packages with natural language descriptions
- Monitor hosting package performance and usage
- Scale resources based on demand
- Automated provisioning and deployment
- Create and manage subdomains for organized site structure
- Set PHP versions for optimal application compatibility
- Install applications like WordPress with one command

### ☁️ **Cloud Server Operations**
- Deploy cloud servers across multiple providers
- Monitor server health and performance
- Scale infrastructure based on requirements
- Automated backup and recovery operations

### 🔧 **DNS Management**
- View and modify DNS records through conversation
- Bulk DNS operations and migrations
- Automated DNS health monitoring
- Advanced DNS configuration management

### 📧 **Premium Email Services**
- Order and manage premium mailbox subscriptions
- Renew existing premium email services
- Generate single sign-on webmail URLs
- Monitor email service usage and billing

### 📮 **Email Configuration Management**
- Configure email settings for hosting packages
- Manage mailbox configurations and quotas
- Set up and modify email forwarding rules
- Monitor email infrastructure health
- Create email accounts directly through conversation
- Set up email forwarders with multiple destinations

### 🗃️ **Database Management**
- Create MySQL databases for applications
- Set up MySQL users with proper permissions
- List and monitor existing databases
- Manage database access and security

### 📁 **File and Access Management**
- Create FTP users for team access
- Manage directories (create/delete)
- Control file access permissions
- Monitor file usage and organization

### 💰 **Account & Billing Management**
- Check account balance and billing status
- Monitor account overview and statistics
- Track API usage and limits
- View reseller account information

### ⚡ **WordPress Management**
- **NEW**: Complete WordPress automation with 15 tools
- Check WordPress installation status and version
- Manage plugins: activate, deactivate, remove, install StackCache
- Theme management: switch themes, remove unused themes
- WordPress staging environments: clone live to staging and vice versa
- User management: list administrators and users
- Configuration management: get/set WordPress settings
- Search and replace operations for migrations
- One-click WordPress updates and reinstallation

### 🚀 **CDN Management**
- **NEW**: Complete CDN automation with 15 tools
- CDN feature configuration and management
- Cache control: get reports, purge cache by URL
- StackCache performance optimization policies
- Security headers management for enhanced protection
- Traffic distribution analytics by country
- Website Turbo service assignment and credit management
- Bandwidth statistics and monitoring
- Performance optimization through CDN features

### 💾 **Backup/Restore Management**
- **NEW**: Complete data protection with 11 tools
- Timeline storage management and snapshot creation
- Web and database snapshot restoration with precise control
- FTP backup restoration and job monitoring
- Multisite backup management across multiple packages
- VPS backup service configuration
- Automated backup job status tracking
- Point-in-time recovery capabilities

### 🔒 **Advanced Security Management**
- **NEW**: Complete security control with 13 tools
- IP address blocking and allowlisting for traffic control
- Country-based access restrictions using ISO codes
- Malware scanning and automated threat detection
- Email spam filtering with blacklist/whitelist management
- Premium SSL/TLS certificate ordering and renewal
- Security monitoring and incident response
- Real-time threat protection and access control

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- 20i Reseller Account with API access
- Claude Desktop, VS Code with Claude, or other MCP-compatible AI assistant

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Cbrown35/20i-MCP.git
   cd 20i-MCP
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Configure your AI assistant:**
   
   Add to your `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "20i-hosting": {
         "command": "node",
         "args": ["/path/to/20i-MCP/build/index.js"],
         "cwd": "/path/to/20i-MCP",
         "env": {
           "TWENTYI_API_KEY": "your_general_api_key",
           "TWENTYI_OAUTH_KEY": "your_oauth_client_key", 
           "TWENTYI_COMBINED_KEY": "your_combined_api_key"
         }
       }
     }
   }
   ```

5. **Restart your AI assistant** and start managing your 20i services with natural language!

## 💬 Usage Examples

### 🌟 Power User Workflows (New!)

**Complete WordPress Site Setup**
```
"Create hosting package for myblog.com, then create a staging subdomain, install WordPress, create MySQL database 'blog_db' and user 'blog_admin', set PHP to 8.2, add SSL certificate, and create FTP user for my developer"
```

**Professional Email Setup**
```
"Create email accounts for support@, sales@, and info@ for mycompany.com, forward all to admin@mycompany.com, then create a premium mailbox for the CEO"
```

**Development Environment**
```
"Set up dev.mysite.com subdomain, install WordPress there, create separate MySQL database 'dev_db', set PHP 8.1, create FTP user 'developer' with access to /dev folder"
```

### Domain Management
```
"List all my domains that expire in the next 30 days"
"Show me DNS records for example.com"
"Add an A record pointing blog.example.com to 192.168.1.100"
```

### Hosting Operations
```
"Create a new hosting package for clientsite.com with WordPress optimization"
"Show me hosting packages using more than 80% of their resources" 
"What's the performance status of all my hosting packages?"
```

### Cloud Infrastructure
```
"Deploy a new cloud server in London with 4GB RAM for my development environment"
"Show me all cloud servers and their current resource usage"
"Scale up the production server to handle increased traffic"
```

### Account Monitoring
```
"Give me an overview of my 20i reseller account"
"What's my current account balance and billing status?"
"What's my current API usage and remaining limits?"
"Show me this month's hosting statistics"
```

### Hosting Management Operations
```
"Create a new subdomain 'blog' for my website"
"Set up a MySQL database called 'ecommerce_data' for my store"
"Create an FTP user for my designer to upload files"
"Install WordPress in the '/blog' directory of my site"
```

### WordPress Management Operations
```
"Check if WordPress is installed on package w12345"
"Update WordPress to the latest version on my site"
"List all WordPress plugins and their status"
"Activate the Yoast SEO plugin on my WordPress site"
"Create a staging environment copy of my live WordPress site"
"Update my WordPress site URL from old-domain.com to new-domain.com"
"Install the StackCache plugin for better performance"
"List all WordPress users and their roles"
```

### CDN and Performance Management
```
"Show me all available CDN features for package w12345"
"Enable all performance CDN features for better site speed"
"Clear CDN cache for https://example.com/updated-page.html"
"Get CDN traffic distribution by country for analytics"
"Set up security headers for enhanced site protection"
"Assign my package to Website Turbo for faster loading"
"Show me CDN cache report and performance statistics"
"Configure StackCache policies for optimal performance"
```

### Backup and Data Protection
```
"Create a snapshot of my website and database for package w12345"
"Show me all available backups for my hosting package"
"Restore my website from yesterday's snapshot"
"List all timeline storage items for data recovery planning"
"Monitor the status of my current backup jobs"
"Create bulk backups for all my client websites"
"Restore the backup file I uploaded via FTP"
"Configure automatic VPS backup settings"
```

### Advanced Security Management
```
"Block IP address 192.168.1.100 from accessing package w12345"
"Show me all blocked IP addresses for my hosting package"
"Block all traffic from China and Russia for enhanced security"
"Remove country block for Germany to allow EU traffic"
"Run a malware scan on package w12345 to check for threats"
"Show me the latest malware report for security analysis"
"Order a premium SSL certificate for mysite.com valid for 12 months"
"Check email spam blacklist settings for support@mysite.com"
"Add 10.0.0.0/8 to IP block list to prevent internal network access"
"Remove IP block for 203.0.113.5 to restore legitimate access"
```

### Database and Development
```
"Create MySQL database 'app_db' and user 'app_user' for my application"
"Upgrade PHP to version 8.2 for better performance"
"List all available applications I can install"
"Set up staging subdomain with separate FTP access"
```

### Email System Management  
```
"Create email account 'support@mysite.com' with secure password"
"Set up email forwarding from 'contact@' to my Gmail account"
"Order a premium mailbox for support@example.com"
"Generate a webmail login URL for user@example.com"
```

### Complete Workflow Examples
```
"Set up a complete WordPress site: create subdomain, install WordPress, create database, and add SSL"
"Prepare development environment: create staging subdomain, set PHP 8.2, create FTP user, install testing tools"
"Email system setup: create support@, sales@, and info@ accounts, then forward all to main inbox"
```

## 🛠️ Available Tools (303 Total) - 90.0% API Coverage (303/335)

### Core Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_reseller_info` | Account overview and statistics | Monitoring, reporting, billing analysis |
| `get_account_balance` | Account balance and billing info | Financial monitoring, payment tracking |
| `list_domains` | Domain portfolio management | Bulk operations, expiration tracking |
| `get_domain_info` | Detailed domain information | Troubleshooting, configuration review |
| `get_dns_records` | DNS configuration retrieval | Troubleshooting, migration planning |
| `update_dns_record` | DNS record management | Configuration changes, traffic routing |
| `register_domain` | Register new domain names | Domain acquisition, business expansion |

### Hosting Package Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `list_hosting_packages` | Hosting inventory management | Resource planning, client management |
| `get_hosting_package_info` | Individual package details | Performance analysis, troubleshooting |
| `get_hosting_package_web_info` | Web-specific package details | Web hosting analysis, configuration |
| `get_hosting_package_limits` | Package quotas and limits | Resource monitoring, upgrade planning |
| `get_hosting_package_usage` | Usage statistics | Performance monitoring, billing analysis |
| `create_hosting_package` | Automated package creation | Client onboarding, rapid deployment |

### WordPress Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `is_wordpress_installed` | Check WordPress installation status | Site verification, troubleshooting |
| `reinstall_wordpress` | Reinstall WordPress software | Site recovery, fresh installation |
| `get_wordpress_settings` | Get WordPress configuration settings | Site analysis, troubleshooting |
| `set_wordpress_settings` | Update WordPress configuration | Site customization, optimization |
| `get_wordpress_version` | Get current WordPress version | Version management, security audits |
| `wordpress_search_replace` | Perform search and replace operations | Migration, URL changes, content updates |
| `get_wordpress_plugins` | List installed WordPress plugins | Plugin management, security audits |
| `manage_wordpress_plugin` | Activate/deactivate/remove plugins | Plugin management, site optimization |
| `install_stackcache_plugin` | Install StackCache optimization plugin | Performance optimization, caching |
| `get_wordpress_themes` | List installed WordPress themes | Theme management, design workflow |
| `manage_wordpress_theme` | Activate/deactivate/remove themes | Theme management, site customization |
| `get_wordpress_users` | List WordPress users | User management, security audits |
| `update_wordpress` | Update WordPress to latest version | Security updates, feature updates |
| `get_wordpress_staging` | Check staging environment status | Development workflow, testing |
| `manage_wordpress_staging` | Clone between live and staging | Development workflow, safe testing |

### CDN Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_cdn_options` | List all available CDN features | Feature discovery, configuration planning |
| `get_cdn_feature_groups` | Get CDN feature groups | Organized feature management |
| `add_cdn_feature` | Add single CDN feature | Feature activation, performance optimization |
| `bulk_add_cdn_features` | Add multiple CDN features | Bulk configuration, setup automation |
| `get_cdn_stats` | Get CDN usage statistics | Performance monitoring, analytics |
| `get_cache_report` | Get CDN cache report | Cache analysis, optimization |
| `purge_cdn_cache` | Purge CDN cache by URL | Content updates, cache management |
| `get_stackcache_settings` | Get StackCache configuration | Performance monitoring, optimization |
| `set_stackcache_policy` | Configure StackCache policies | Performance tuning, resource optimization |
| `get_cdn_security_headers` | Get security headers | Security auditing, compliance |
| `update_cdn_security_headers` | Update security headers | Security enhancement, policy enforcement |
| `delete_cdn_security_headers` | Delete security headers | Configuration cleanup, policy changes |
| `get_cdn_traffic_distribution` | Get traffic by country | Analytics, geographic performance |
| `assign_website_turbo` | Assign package to Website Turbo | Performance acceleration, service activation |
| `order_website_turbo_credits` | Order Website Turbo credits | Service provisioning, account management |

### Backup/Restore Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `list_timeline_storage` | List timeline storage items | Backup inventory, storage management |
| `create_snapshot` | Create immediate snapshots | Data protection, backup creation |
| `list_snapshots` | List available snapshots | Recovery planning, backup history |
| `restore_snapshot` | Restore from timeline snapshots | Data recovery, point-in-time restoration |
| `get_snapshot_jobs` | Monitor snapshot job status | Process tracking, job management |
| `restore_ftp_backup` | Restore FTP-uploaded backups | External backup restoration |
| `list_backup_jobs` | Monitor backup/restore progress | Job tracking, status monitoring |
| `list_multisite_backups` | List multisite backup info | Bulk backup management |
| `create_multisite_backup` | Backup multiple packages | Bulk operations, enterprise backup |
| `list_vps_backups` | List VPS backup services | VPS data protection |
| `update_vps_backup` | Configure VPS backup settings | VPS backup automation |

### Advanced Security Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_blocked_ip_addresses` | List blocked IP addresses | Security auditing, access control review |
| `set_blocked_ip_addresses` | Set blocked IP addresses | Bulk IP blocking, security policy enforcement |
| `add_ip_block` | Block single IP address | Immediate threat response, targeted blocking |
| `remove_ip_block` | Remove IP address block | Access restoration, policy updates |
| `get_blocked_countries` | List blocked countries | Geographic security review, compliance |
| `set_blocked_countries` | Set blocked countries | Bulk country blocking, geo-restrictions |
| `add_country_block` | Block single country | Targeted geographic blocking, security |
| `remove_country_block` | Remove country block | Access restoration, policy changes |
| `get_malware_scan` | Check malware scan status | Security monitoring, threat assessment |
| `request_malware_scan` | Request new malware scan | Proactive security scanning, incident response |
| `get_malware_report` | Get detailed malware report | Security analysis, threat investigation |
| `get_email_spam_blacklist` | View email spam blacklist | Email security auditing, filter management |
| `get_email_spam_whitelist` | View email spam whitelist | Email security configuration, legitimate sender management |
| `add_tls_certificate` | Order premium SSL certificate | Enhanced security, commercial SSL deployment |
| `renew_tls_certificate` | Renew SSL certificate | Certificate lifecycle management, security maintenance |

### Database Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_mysql_databases` | List MySQL databases | Database management, backup planning |
| `get_mysql_users` | List MySQL users | User management, security auditing |
| `get_mssql_databases` | List MSSQL databases | Windows hosting database management |
| `create_mysql_database` | Create MySQL database | Database provisioning, application setup |
| `create_mysql_user` | Create MySQL user | Database access management, security |

### SSL Certificate Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_ssl_certificates` | View SSL certificates | Security monitoring, renewal tracking |
| `add_free_ssl` | Add free SSL certificates | Security automation, HTTPS setup |
| `get_force_ssl` | Check Force HTTPS status | Security auditing, configuration review |
| `set_force_ssl` | Enable/disable Force HTTPS | Security management, site configuration |

### Statistics & Monitoring
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_bandwidth_stats` | Bandwidth usage statistics | Performance monitoring, cost analysis |
| `get_disk_usage` | Disk usage reporting | Storage monitoring, cleanup planning |
| `get_access_logs` | Web server access logs | Traffic analysis, troubleshooting |

### Cloud Infrastructure
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `list_cloud_servers` | Cloud infrastructure overview | Capacity planning, cost optimization |
| `create_cloud_server` | On-demand server provisioning | Scaling, development environments |
| `list_vps` | List VPS servers | Infrastructure management, monitoring |
| `get_vps_info` | VPS server details | Performance analysis, troubleshooting |
| `list_managed_vps` | List managed VPS servers | Managed infrastructure overview |
| `get_managed_vps_info` | Managed VPS details | Managed service monitoring |

### Premium Email Services
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `order_premium_mailbox` | Order premium email services | Premium email sales, client onboarding |
| `renew_premium_mailbox` | Renew premium email subscriptions | Service renewals, billing management |
| `get_email_configuration` | Email domain configuration | Email troubleshooting, setup verification |
| `get_mailbox_configuration` | Mailbox settings and quotas | Account management, usage monitoring |
| `get_email_forwarders` | Email forwarding rules | Email routing, configuration review |
| `get_all_email_forwarders` | All package email forwarders | Bulk management, migration planning |
| `generate_webmail_url` | Single sign-on webmail access | Customer support, easy access provision |
| `create_email_account` | Create email accounts | Email provisioning, user onboarding |
| `create_email_forwarder` | Create email forwarders | Email routing automation, workflow setup |

### Subdomain Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `create_subdomain` | Create subdomains | Site organization, service deployment |
| `remove_subdomain` | Remove subdomains | Cleanup, site restructuring |
| `list_subdomains` | List all subdomains | Inventory management, organization |

### PHP and Application Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `get_php_versions` | List available PHP versions | Compatibility planning, upgrades |
| `set_php_version` | Set PHP version | Performance optimization, compatibility |
| `list_applications` | List installable applications | Application deployment, site setup |
| `install_application` | Install applications | Automated deployment, rapid setup |

### FTP and File Management
| Tool | Description | Use Cases |
|------|-------------|-----------|
| `create_ftp_user` | Create FTP users | Access management, team collaboration |
| `list_ftp_users` | List FTP users | Security auditing, access review |
| `manage_directories` | Create/delete directories | File organization, site structure |

## 🏗️ Architecture

- **TypeScript**: Type-safe, maintainable codebase
- **MCP Protocol**: Standards-compliant AI assistant integration
- **RESTful API**: Clean integration with 20i's API infrastructure
- **Environment-based Configuration**: Secure credential management
- **Error Handling**: Comprehensive error reporting and recovery
- **Modular Design**: Easy to extend and customize

## 🔒 Security

- Environment variable credential storage
- No sensitive data in code or logs
- Secure API token handling
- Rate limiting and error recovery
- Input validation and sanitization

## 🤝 Contributing

We welcome contributions! This project represents the cutting edge of AI-powered hosting management.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Recognition

This is the **first Model Context Protocol server for 20i hosting services**, pioneering AI-powered hosting management. If you're from 20i and interested in this integration, we'd love to discuss how this can benefit your customers and business.

## 📞 Contact

- **GitHub**: [@Cbrown35](https://github.com/Cbrown35)
- **Project**: [20i-MCP](https://github.com/Cbrown35/20i-MCP)

---

**Created by**: ClaudeCode 4 & DZIND .Inc

*Built with ❤️ for the 20i community. Empowering hosting management through AI.*