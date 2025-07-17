#!/usr/bin/env node

// WordPress deployment script for HomeHealthcare.dzind.com
// This script uses the correct 20i API endpoints

import { config } from 'dotenv';
config();

import axios from 'axios';

class WordPressDeployer {
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
    this.dbName = 'homehealthcare_wp';
    this.dbUser = 'hh_wp_user';
    this.dbPassword = this.generatePassword();
    this.wpAdminPassword = this.generatePassword();
    this.emailPassword = this.generatePassword();
  }

  async deployWordPress() {
    console.log('🚀 Starting WordPress deployment for HomeHealthcare.dzind.com...');
    
    try {
      // Step 1: Check current hosting package details
      console.log('\n1. Checking hosting package details...');
      await this.checkPackageDetails();
      
      // Step 2: Create MySQL database
      console.log('\n2. Creating MySQL database...');
      await this.createDatabase();
      
      // Step 3: Create MySQL user and grant permissions
      console.log('\n3. Creating MySQL user and granting permissions...');
      await this.createDatabaseUser();
      
      // Step 4: Check for WordPress installation options
      console.log('\n4. Checking WordPress installation options...');
      await this.checkWordPressOptions();
      
      // Step 5: Set up SSL certificate
      console.log('\n5. Setting up SSL certificate...');
      await this.setupSSL();
      
      // Step 6: Create email accounts
      console.log('\n6. Creating email accounts...');
      await this.createEmailAccounts();
      
      // Step 7: Configure email authentication
      console.log('\n7. Configuring email authentication...');
      await this.setupEmailAuthentication();
      
      console.log('\n🎉 WordPress deployment infrastructure completed successfully!');
      console.log('✅ Site URL: https://HomeHealthcare.dzind.com');
      console.log('✅ Database:', this.dbName);
      console.log('✅ Database User:', this.dbUser);
      console.log('✅ Email accounts: do_not_reply@HomeHealthcare.dzind.com, support@HomeHealthcare.dzind.com');
      
      console.log('\n📋 Next Steps:');
      console.log('1. WordPress needs to be installed manually or via one-click installer');
      console.log('2. Configure WordPress with database credentials');
      console.log('3. Set up CDN and performance optimization');
      console.log('4. Configure security settings and monitoring');
      
    } catch (error) {
      console.error('❌ WordPress deployment failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async checkPackageDetails() {
    try {
      const response = await this.apiClient.get(`/package/${this.mainPackageId}`);
      console.log('✅ Package details retrieved successfully');
      console.log('   Package name:', response.data?.name || 'Unknown');
      console.log('   Package type:', response.data?.type || 'Unknown');
      console.log('   Domain:', response.data?.domain_name || 'Unknown');
      
    } catch (error) {
      console.log('⚠️  Could not retrieve package details:', error.message);
    }
  }

  async createDatabase() {
    try {
      // Check existing databases first
      const existingDbResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/mysqlDatabases`);
      const existingDatabases = Array.isArray(existingDbResponse.data) ? existingDbResponse.data : [];
      
      console.log(`   Found ${existingDatabases.length} existing databases`);
      
      // Check if our database already exists
      const dbExists = existingDatabases.find(db => db.name === this.dbName);
      if (dbExists) {
        console.log(`✅ Database ${this.dbName} already exists - continuing...`);
        return;
      }
      
      // Create new database
      const response = await this.apiClient.post(`/package/${this.mainPackageId}/web/mysqlDatabases`, {
        name: this.dbName
      });
      
      console.log('✅ Database created successfully');
      console.log('   Database name:', this.dbName);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to create database:', error.message);
      throw error;
    }
  }

  async createDatabaseUser() {
    try {
      // Check existing users first
      const existingUsersResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/mysqlUsers`);
      const existingUsers = Array.isArray(existingUsersResponse.data) ? existingUsersResponse.data : [];
      
      console.log(`   Found ${existingUsers.length} existing database users`);
      
      // Check if our user already exists
      const userExists = existingUsers.find(user => user.username === this.dbUser);
      if (userExists) {
        console.log(`✅ Database user ${this.dbUser} already exists - continuing...`);
      } else {
        // Create new database user
        const userResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/mysqlUsers`, {
          username: this.dbUser,
          password: this.dbPassword
        });
        
        console.log('✅ Database user created successfully');
        console.log('   Username:', this.dbUser);
        console.log('   Response:', JSON.stringify(userResponse.data, null, 2));
      }
      
      // Grant database access to user
      const grantResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/mysqlGrantUserDatabase`, {
        username: this.dbUser,
        database: this.dbName
      });
      
      console.log('✅ Database permissions granted successfully');
      console.log('   Grant response:', JSON.stringify(grantResponse.data, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to create database user or grant permissions:', error.message);
      throw error;
    }
  }

  async checkWordPressOptions() {
    try {
      // Get available one-click applications
      const appsResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/applications`);
      const applications = Array.isArray(appsResponse.data) ? appsResponse.data : [];
      
      console.log(`   Found ${applications.length} available one-click applications`);
      
      // Look for WordPress
      const wordpressApps = applications.filter(app => 
        app.name?.toLowerCase().includes('wordpress') || 
        app.title?.toLowerCase().includes('wordpress')
      );
      
      if (wordpressApps.length > 0) {
        console.log('✅ WordPress one-click installation available:');
        wordpressApps.forEach(app => {
          console.log(`   - ${app.name || app.title} (ID: ${app.id})`);
        });
      } else {
        console.log('⚠️  No WordPress one-click installation found');
        console.log('   Available applications:');
        applications.slice(0, 5).forEach(app => {
          console.log(`   - ${app.name || app.title}`);
        });
      }
      
    } catch (error) {
      console.log('⚠️  Could not retrieve one-click applications:', error.message);
    }
  }

  async setupSSL() {
    try {
      // Get existing SSL certificates
      const sslResponse = await this.apiClient.get(`/package/${this.mainPackageId}/ssl`);
      const certificates = Array.isArray(sslResponse.data) ? sslResponse.data : [];
      
      console.log(`   Found ${certificates.length} existing SSL certificates`);
      
      // Check if SSL already exists for our subdomain
      const existingSSL = certificates.find(cert => 
        cert.domains?.includes(this.targetSubdomain) ||
        cert.commonName === this.targetSubdomain
      );
      
      if (existingSSL) {
        console.log(`✅ SSL certificate already exists for ${this.targetSubdomain}`);
      } else {
        // Request free SSL certificate
        const newSslResponse = await this.apiClient.post(`/package/${this.mainPackageId}/ssl/letsencrypt`, {
          domains: [this.targetSubdomain]
        });
        
        console.log('✅ SSL certificate requested successfully');
        console.log('   Response:', JSON.stringify(newSslResponse.data, null, 2));
      }
      
      // Check Force HTTPS setting
      const forceHttpsResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/forceHttps`);
      console.log('✅ Force HTTPS status:', forceHttpsResponse.data?.enabled ? 'Enabled' : 'Disabled');
      
    } catch (error) {
      console.error('❌ Failed to setup SSL:', error.message);
      // Don't throw - SSL can be configured later
    }
  }

  async createEmailAccounts() {
    try {
      // Create do_not_reply email account
      const doNotReplyResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email`, {
        local: 'do_not_reply',
        domain: 'HomeHealthcare.dzind.com',
        password: this.emailPassword
      });
      
      console.log('✅ do_not_reply email account created successfully');
      console.log('   Response:', JSON.stringify(doNotReplyResponse.data, null, 2));
      
      // Create support email account
      const supportResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email`, {
        local: 'support',
        domain: 'HomeHealthcare.dzind.com',
        password: this.emailPassword
      });
      
      console.log('✅ support email account created successfully');
      console.log('   Response:', JSON.stringify(supportResponse.data, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to create email accounts:', error.message);
      // Don't throw - email accounts can be created later
    }
  }

  async setupEmailAuthentication() {
    try {
      // Set up DKIM signature for do_not_reply account
      const dkimResponse1 = await this.apiClient.post(`/package/${this.mainPackageId}/email/dkim`, {
        domain: 'HomeHealthcare.dzind.com',
        selector: 'do_not_reply'
      });
      
      console.log('✅ DKIM signature configured for do_not_reply account');
      
      // Set up DKIM signature for support account
      const dkimResponse2 = await this.apiClient.post(`/package/${this.mainPackageId}/email/dkim`, {
        domain: 'HomeHealthcare.dzind.com',
        selector: 'support'
      });
      
      console.log('✅ DKIM signature configured for support account');
      
    } catch (error) {
      console.error('❌ Failed to setup email authentication:', error.message);
      // Don't throw - email authentication can be configured later
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
    const deployer = new WordPressDeployer();
    await deployer.deployWordPress();
    
    console.log('\n🔐 Generated Credentials (SAVE THESE SECURELY):');
    console.log('Database Name:', deployer.dbName);
    console.log('Database User:', deployer.dbUser);
    console.log('Database Password:', deployer.dbPassword);
    console.log('WordPress Admin Password:', deployer.wpAdminPassword);
    console.log('Email Password:', deployer.emailPassword);
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

runDeployment();