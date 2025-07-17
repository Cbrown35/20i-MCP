#!/usr/bin/env node

// Real WordPress deployment using direct 20i API calls
// This will actually create the infrastructure for HomeHealthcare.dzind.com

import { config } from 'dotenv';
config();

import axios from 'axios';

class RealWordPressDeployer {
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
    
    this.mainPackageId = '3145084'; // dzind.com package ID
    this.subdomainName = 'HomeHealthcare';
    this.fullDomain = 'HomeHealthcare.dzind.com';
    
    // Generate secure credentials
    this.dbName = 'homehealthcare_wp';
    this.dbUser = 'hh_wp_user';
    this.dbPassword = this.generateSecurePassword();
    this.wpAdminUser = 'hhc_admin';
    this.wpAdminPassword = this.generateSecurePassword();
    this.wpAdminEmail = 'admin@HomeHealthcare.dzind.com';
    this.emailPassword = this.generateSecurePassword();
  }

  async deployWordPress() {
    console.log('🚀 Starting REAL WordPress deployment for HomeHealthcare.dzind.com...');
    console.log('📦 Package ID:', this.mainPackageId);
    console.log('🌐 Target Domain:', this.fullDomain);
    
    try {
      // Step 1: Create MySQL database
      console.log('\n1. Creating MySQL database...');
      await this.createMySQLDatabase();
      
      // Step 2: Create MySQL user
      console.log('\n2. Creating MySQL user...');
      await this.createMySQLUser();
      
      // Step 3: Grant database permissions
      console.log('\n3. Granting database permissions...');
      await this.grantDatabasePermissions();
      
      // Step 4: Create subdomain for WordPress
      console.log('\n4. Creating subdomain for WordPress...');
      await this.createWordPressSubdomain();
      
      // Step 5: Install WordPress
      console.log('\n5. Installing WordPress...');
      await this.installWordPress();
      
      // Step 6: Configure WordPress settings
      console.log('\n6. Configuring WordPress settings...');
      await this.configureWordPress();
      
      // Step 7: Create email accounts
      console.log('\n7. Creating email accounts...');
      await this.createEmailAccounts();
      
      // Step 8: Set up SSL certificate
      console.log('\n8. Setting up SSL certificate...');
      await this.setupSSL();
      
      console.log('\n🎉 WordPress deployment completed successfully!');
      console.log('✅ Site URL: https://' + this.fullDomain);
      console.log('✅ WordPress Admin: https://' + this.fullDomain + '/wp-admin');
      console.log('✅ Database:', this.dbName);
      console.log('✅ MySQL User:', this.dbUser);
      
      this.displayCredentials();
      
    } catch (error) {
      console.error('❌ WordPress deployment failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async createMySQLDatabase() {
    try {
      // First check if database already exists
      const existingResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/mysqlDatabases`);
      const existingDatabases = Array.isArray(existingResponse.data) ? existingResponse.data : [];
      
      const dbExists = existingDatabases.find(db => db.name?.includes('homehealthcare'));
      if (dbExists) {
        console.log('✅ MySQL database already exists:', dbExists.name);
        this.dbName = dbExists.name;
        return;
      }
      
      // Create new database
      const response = await this.apiClient.post(`/package/${this.mainPackageId}/web/mysqlDatabases`, {
        name: this.dbName
      });
      
      console.log('✅ MySQL database created successfully');
      console.log('   Database name:', this.dbName);
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.error('❌ Failed to create MySQL database:', error.message);
      if (error.response?.status === 400) {
        console.log('   Database may already exist or name is invalid');
      }
      throw error;
    }
  }

  async createMySQLUser() {
    try {
      // First check if user already exists
      const existingResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/mysqlUsers`);
      const existingUsers = Array.isArray(existingResponse.data) ? existingResponse.data : [];
      
      const userExists = existingUsers.find(user => user.username === this.dbUser);
      if (userExists) {
        console.log('✅ MySQL user already exists:', this.dbUser);
        return;
      }
      
      // Create new user
      const response = await this.apiClient.post(`/package/${this.mainPackageId}/web/mysqlUsers`, {
        username: this.dbUser,
        password: this.dbPassword
      });
      
      console.log('✅ MySQL user created successfully');
      console.log('   Username:', this.dbUser);
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.error('❌ Failed to create MySQL user:', error.message);
      if (error.response?.status === 400) {
        console.log('   User may already exist or username is invalid');
      }
      throw error;
    }
  }

  async grantDatabasePermissions() {
    try {
      const response = await this.apiClient.post(`/package/${this.mainPackageId}/web/mysqlGrantUserDatabase`, {
        username: this.dbUser,
        database: this.dbName
      });
      
      console.log('✅ Database permissions granted successfully');
      console.log('   User:', this.dbUser);
      console.log('   Database:', this.dbName);
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.error('❌ Failed to grant database permissions:', error.message);
      if (error.response?.status === 400) {
        console.log('   Permissions may already be granted');
      }
      // Don't throw - this might already be set up
    }
  }

  async createWordPressSubdomain() {
    try {
      // Check existing subdomains
      const existingResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/subdomains`);
      const existingSubdomains = Array.isArray(existingResponse.data) ? existingResponse.data : [];
      
      console.log('   Existing subdomains:', existingSubdomains);
      
      const subdomainExists = existingSubdomains.find(sub => 
        (sub.name || sub) === this.subdomainName || 
        (sub.name || sub) === this.fullDomain
      );
      
      if (subdomainExists) {
        console.log('✅ Subdomain already exists:', this.subdomainName);
        return;
      }
      
      // Create new subdomain
      const response = await this.apiClient.post(`/package/${this.mainPackageId}/web/subdomains`, {
        name: this.subdomainName
      });
      
      console.log('✅ Subdomain created successfully');
      console.log('   Subdomain:', this.subdomainName);
      console.log('   Full domain:', this.fullDomain);
      console.log('   Response:', response.data);
      
    } catch (error) {
      console.error('❌ Failed to create subdomain:', error.message);
      if (error.response?.status === 400) {
        console.log('   Subdomain may already exist');
      }
      throw error;
    }
  }

  async installWordPress() {
    try {
      // Check if WordPress is already installed
      const wpCheckResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/wordpressInstalled`);
      if (wpCheckResponse.data === true) {
        console.log('✅ WordPress already installed on package');
        return;
      }
      
      // Get available one-click applications
      const appsResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/oneClickApps`);
      const applications = Array.isArray(appsResponse.data) ? appsResponse.data : [];
      
      console.log('   Available applications:', applications.map(app => app.name || app.title));
      
      // Find WordPress
      const wordpressApp = applications.find(app => 
        (app.name || app.title || '').toLowerCase().includes('wordpress')
      );
      
      if (!wordpressApp) {
        console.log('⚠️  WordPress not found in one-click apps, trying direct installation');
        
        // Try direct WordPress installation
        const directInstallResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/installWordpress`, {
          site_title: 'Home Healthcare Services',
          admin_user: this.wpAdminUser,
          admin_password: this.wpAdminPassword,
          admin_email: this.wpAdminEmail,
          database_name: this.dbName,
          database_user: this.dbUser,
          database_password: this.dbPassword,
          subdomain: this.subdomainName
        });
        
        console.log('✅ WordPress installed directly');
        console.log('   Response:', directInstallResponse.data);
        return;
      }
      
      // Install WordPress using one-click app
      const installResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/installOneClickApp`, {
        app_id: wordpressApp.id,
        subdomain: this.subdomainName,
        config: {
          site_title: 'Home Healthcare Services',
          admin_user: this.wpAdminUser,
          admin_password: this.wpAdminPassword,
          admin_email: this.wpAdminEmail,
          database_name: this.dbName,
          database_user: this.dbUser,
          database_password: this.dbPassword
        }
      });
      
      console.log('✅ WordPress installed successfully');
      console.log('   App ID:', wordpressApp.id);
      console.log('   Response:', installResponse.data);
      
    } catch (error) {
      console.error('❌ Failed to install WordPress:', error.message);
      console.log('   WordPress installation will need to be done manually');
      // Don't throw - we can continue with other steps
    }
  }

  async configureWordPress() {
    try {
      // Set WordPress site title
      const titleResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/wordpressSettings`, {
        option_name: 'blogname',
        option_value: 'Home Healthcare Services'
      });
      
      console.log('✅ WordPress site title configured');
      
      // Set WordPress description
      const descResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/wordpressSettings`, {
        option_name: 'blogdescription',
        option_value: 'Professional Healthcare Solutions'
      });
      
      console.log('✅ WordPress description configured');
      
      // Set WordPress admin email
      const emailResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/wordpressSettings`, {
        option_name: 'admin_email',
        option_value: this.wpAdminEmail
      });
      
      console.log('✅ WordPress admin email configured');
      
    } catch (error) {
      console.error('❌ Failed to configure WordPress:', error.message);
      console.log('   WordPress configuration will need to be done manually');
    }
  }

  async createEmailAccounts() {
    try {
      // Create do_not_reply email account
      const doNotReplyResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email/createAccount`, {
        local: 'do_not_reply',
        domain: this.fullDomain,
        password: this.emailPassword
      });
      
      console.log('✅ do_not_reply email account created');
      console.log('   Email: do_not_reply@' + this.fullDomain);
      
      // Create support email account
      const supportResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email/createAccount`, {
        local: 'support',
        domain: this.fullDomain,
        password: this.emailPassword
      });
      
      console.log('✅ support email account created');
      console.log('   Email: support@' + this.fullDomain);
      
    } catch (error) {
      console.error('❌ Failed to create email accounts:', error.message);
      console.log('   Email accounts will need to be created manually');
    }
  }

  async setupSSL() {
    try {
      // Request free SSL certificate
      const sslResponse = await this.apiClient.post(`/package/${this.mainPackageId}/ssl/requestFreeSSL`, {
        domains: [this.fullDomain]
      });
      
      console.log('✅ SSL certificate requested');
      console.log('   Domain:', this.fullDomain);
      console.log('   Response:', sslResponse.data);
      
      // Enable Force HTTPS
      const forceHttpsResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/forceHttps`, {
        enabled: true
      });
      
      console.log('✅ Force HTTPS enabled');
      
    } catch (error) {
      console.error('❌ Failed to setup SSL:', error.message);
      console.log('   SSL certificate will need to be requested manually');
    }
  }

  generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 20; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  displayCredentials() {
    console.log('\n🔐 SAVE THESE CREDENTIALS SECURELY:');
    console.log('=====================================');
    console.log('WordPress Admin URL: https://' + this.fullDomain + '/wp-admin');
    console.log('WordPress Admin User:', this.wpAdminUser);
    console.log('WordPress Admin Password:', this.wpAdminPassword);
    console.log('WordPress Admin Email:', this.wpAdminEmail);
    console.log('');
    console.log('Database Name:', this.dbName);
    console.log('Database User:', this.dbUser);
    console.log('Database Password:', this.dbPassword);
    console.log('Database Host: localhost');
    console.log('');
    console.log('Email Accounts:');
    console.log('- do_not_reply@' + this.fullDomain);
    console.log('- support@' + this.fullDomain);
    console.log('Email Password:', this.emailPassword);
    console.log('=====================================');
  }
}

// Run the deployment
async function runDeployment() {
  try {
    const deployer = new RealWordPressDeployer();
    await deployer.deployWordPress();
    
    console.log('\n📋 Manual Steps Required:');
    console.log('1. Access 20i control panel at https://cp.20i.com');
    console.log('2. Navigate to Package 3145084 (dzind.com)');
    console.log('3. Install WordPress manually if automatic installation failed');
    console.log('4. Configure email accounts in Email section');
    console.log('5. Request SSL certificate in SSL section');
    console.log('6. Test the site at https://HomeHealthcare.dzind.com');
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

runDeployment();