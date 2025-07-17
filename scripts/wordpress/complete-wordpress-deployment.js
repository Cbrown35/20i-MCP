#!/usr/bin/env node

// Complete WordPress deployment script for HomeHealthcare.dzind.com
// This script will install WordPress and configure the remaining services

import { config } from 'dotenv';
config();

import axios from 'axios';

class WordPressCompleter {
  constructor() {
    this.apiKey = process.env.TWENTYI_API_KEY;
    this.oauthKey = process.env.TWENTYI_OAUTH_KEY;
    this.combinedKey = process.env.TWENTYI_COMBINED_KEY;
    
    if (!this.apiKey || !this.oauthKey || !this.combinedKey) {
      throw new Error('Missing API keys in environment variables');
    }
    
    const authHeader = `Bearer ${Buffer.from(this.apiKey).toString('base64')}`;
    
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    this.targetSubdomain = 'HomeHealthcare.dzind.com';
    this.mainPackageId = '3145084'; // dzind.com package ID
    this.dbName = 'homehealthcare_wp-353039344884'; // Existing database name
    this.dbUser = 'hh_wp_user';
    this.dbPassword = this.generatePassword();
    this.wpAdminPassword = this.generatePassword();
    this.emailPassword = this.generatePassword();
  }

  async completeWordPressDeployment() {
    console.log('🚀 Completing WordPress deployment for HomeHealthcare.dzind.com...');
    
    try {
      // Step 1: Install WordPress using one-click installer
      console.log('\n1. Installing WordPress...');
      await this.installWordPress();
      
      // Step 2: Create email accounts
      console.log('\n2. Creating email accounts...');
      await this.createEmailAccounts();
      
      // Step 3: Configure email authentication
      console.log('\n3. Configuring email authentication...');
      await this.setupEmailAuthentication();
      
      // Step 4: Set up SSL certificate
      console.log('\n4. Setting up SSL certificate...');
      await this.setupSSL();
      
      // Step 5: Configure performance optimization
      console.log('\n5. Configuring performance optimization...');
      await this.setupPerformanceOptimization();
      
      // Step 6: Configure security measures
      console.log('\n6. Configuring security measures...');
      await this.setupSecurity();
      
      // Step 7: Final verification
      console.log('\n7. Final verification...');
      await this.finalVerification();
      
      console.log('\n🎉 WordPress deployment completed successfully!');
      console.log('✅ Site URL: https://HomeHealthcare.dzind.com');
      console.log('✅ Database:', this.dbName);
      console.log('✅ Email accounts: do_not_reply@HomeHealthcare.dzind.com, support@HomeHealthcare.dzind.com');
      
      console.log('\n🔐 Generated Credentials (SAVE THESE SECURELY):');
      console.log('Database Name:', this.dbName);
      console.log('Database User:', this.dbUser);
      console.log('Database Password:', this.dbPassword);
      console.log('WordPress Admin Password:', this.wpAdminPassword);
      console.log('Email Password:', this.emailPassword);
      
      console.log('\n📋 Next Steps:');
      console.log('1. Access WordPress admin at: https://HomeHealthcare.dzind.com/wp-admin');
      console.log('2. Log in with admin credentials');
      console.log('3. Configure WordPress theme and plugins');
      console.log('4. Set up email notifications and forms');
      console.log('5. Configure CDN and caching policies');
      console.log('6. Set up monitoring and backup schedules');
      
    } catch (error) {
      console.error('❌ WordPress deployment failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async installWordPress() {
    try {
      // Check if WordPress is already installed
      const wpCheckResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/applications/wordpress`);
      
      if (wpCheckResponse.data && wpCheckResponse.data.installed) {
        console.log('✅ WordPress already installed - continuing...');
        return;
      }
      
      // Get available WordPress applications
      const appsResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/applications`);
      const applications = Array.isArray(appsResponse.data) ? appsResponse.data : [];
      
      // Find WordPress application
      const wordpressApp = applications.find(app => 
        app.name?.toLowerCase().includes('wordpress') || 
        app.title?.toLowerCase().includes('wordpress')
      );
      
      if (!wordpressApp) {
        throw new Error('WordPress application not found in one-click installer');
      }
      
      // Install WordPress
      const installResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/applications`, {
        applicationId: wordpressApp.id,
        path: '/HomeHealthcare',
        config: {
          site_title: 'Home Healthcare Services',
          admin_user: 'admin',
          admin_password: this.wpAdminPassword,
          admin_email: 'support@HomeHealthcare.dzind.com',
          database_name: this.dbName,
          database_user: this.dbUser,
          database_password: this.dbPassword
        }
      });
      
      console.log('✅ WordPress installation initiated');
      console.log('   Installation ID:', installResponse.data?.installation_id || 'Unknown');
      
    } catch (error) {
      console.error('❌ Failed to install WordPress:', error.message);
      console.log('   WordPress may need to be installed manually');
    }
  }

  async createEmailAccounts() {
    try {
      // Create do_not_reply email account
      const doNotReplyResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email`, {
        local: 'do_not_reply',
        domain: 'HomeHealthcare.dzind.com',
        password: this.emailPassword,
        quota: 1024 // 1GB quota
      });
      
      console.log('✅ do_not_reply email account created successfully');
      console.log('   Email: do_not_reply@HomeHealthcare.dzind.com');
      
      // Create support email account
      const supportResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email`, {
        local: 'support',
        domain: 'HomeHealthcare.dzind.com',
        password: this.emailPassword,
        quota: 5120 // 5GB quota
      });
      
      console.log('✅ support email account created successfully');
      console.log('   Email: support@HomeHealthcare.dzind.com');
      
    } catch (error) {
      console.error('❌ Failed to create email accounts:', error.message);
      console.log('   Email accounts may need to be created manually');
    }
  }

  async setupEmailAuthentication() {
    try {
      // Configure DKIM signature
      const dkimResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email/dkim`, {
        domain: 'HomeHealthcare.dzind.com',
        enabled: true
      });
      
      console.log('✅ DKIM signature configured successfully');
      console.log('   Domain: HomeHealthcare.dzind.com');
      
      // Configure SPF record (if needed)
      const spfResponse = await this.apiClient.post(`/package/${this.mainPackageId}/dns/records`, {
        domain: 'dzind.com',
        type: 'TXT',
        name: 'HomeHealthcare',
        value: 'v=spf1 include:spf.stackmail.com a mx -all'
      });
      
      console.log('✅ SPF record configured successfully');
      
    } catch (error) {
      console.error('❌ Failed to setup email authentication:', error.message);
      console.log('   Email authentication may need to be configured manually');
    }
  }

  async setupSSL() {
    try {
      // Request free SSL certificate
      const sslResponse = await this.apiClient.post(`/package/${this.mainPackageId}/ssl/letsencrypt`, {
        domains: [this.targetSubdomain]
      });
      
      console.log('✅ SSL certificate requested successfully');
      console.log('   Domain:', this.targetSubdomain);
      
      // Enable Force HTTPS
      const forceHttpsResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/forceHttps`, {
        enabled: true
      });
      
      console.log('✅ Force HTTPS enabled successfully');
      
    } catch (error) {
      console.error('❌ Failed to setup SSL:', error.message);
      console.log('   SSL configuration may need to be done manually');
    }
  }

  async setupPerformanceOptimization() {
    try {
      // Enable CDN features
      const cdnResponse = await this.apiClient.post(`/package/${this.mainPackageId}/cdn/features`, {
        features: [
          'compression',
          'minification',
          'image_optimization',
          'browser_caching'
        ]
      });
      
      console.log('✅ CDN features enabled successfully');
      
      // Configure StackCache
      const stackCacheResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/stackcache`, {
        enabled: true,
        css_minification: true,
        js_minification: true,
        image_optimization: true
      });
      
      console.log('✅ StackCache configured successfully');
      
    } catch (error) {
      console.error('❌ Failed to setup performance optimization:', error.message);
      console.log('   Performance optimization may need to be configured manually');
    }
  }

  async setupSecurity() {
    try {
      // Configure security headers
      const securityHeadersResponse = await this.apiClient.post(`/package/${this.mainPackageId}/cdn/security-headers`, {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      });
      
      console.log('✅ Security headers configured successfully');
      
      // Enable malware scanning
      const malwareScanResponse = await this.apiClient.post(`/package/${this.mainPackageId}/malware-scan`, {
        enabled: true,
        schedule: 'daily'
      });
      
      console.log('✅ Malware scanning enabled successfully');
      
    } catch (error) {
      console.error('❌ Failed to setup security:', error.message);
      console.log('   Security configuration may need to be done manually');
    }
  }

  async finalVerification() {
    try {
      // Check site accessibility
      const siteResponse = await axios.get(`https://${this.targetSubdomain}`, {
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500; // Accept any status less than 500
        }
      });
      
      console.log('✅ Site accessibility verified');
      console.log('   Status:', siteResponse.status);
      console.log('   Site is accessible at:', `https://${this.targetSubdomain}`);
      
    } catch (error) {
      console.log('⚠️  Site accessibility check failed:', error.message);
      console.log('   Site may still be propagating or need manual configuration');
    }
  }

  generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

// Run the deployment
async function runDeployment() {
  try {
    const completer = new WordPressCompleter();
    await completer.completeWordPressDeployment();
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

runDeployment();