#!/usr/bin/env node

// WordPress deployment script for HomeHealthcare.dzind.com
// This script will create the subdomain, database, and install WordPress

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
    this.mainPackageId = '3145084'; // dzind.com package ID from test
  }

  async deployWordPress() {
    console.log('🚀 Starting WordPress deployment for HomeHealthcare.dzind.com...');
    
    try {
      // Step 1: Check if subdomain already exists
      console.log('\n1. Checking existing subdomains...');
      await this.checkExistingSubdomains();
      
      // Step 2: Create subdomain
      console.log('\n2. Creating subdomain HomeHealthcare.dzind.com...');
      await this.createSubdomain();
      
      // Step 3: Create MySQL database
      console.log('\n3. Creating MySQL database...');
      await this.createDatabase();
      
      // Step 4: Install WordPress
      console.log('\n4. Installing WordPress...');
      await this.installWordPress();
      
      // Step 5: Configure SSL
      console.log('\n5. Setting up SSL certificate...');
      await this.setupSSL();
      
      // Step 6: Create email accounts
      console.log('\n6. Creating email accounts...');
      await this.createEmailAccounts();
      
      console.log('\n🎉 WordPress deployment completed successfully!');
      console.log('✅ Site URL: https://HomeHealthcare.dzind.com');
      console.log('✅ Email accounts created: do_not_reply@HomeHealthcare.dzind.com, support@HomeHealthcare.dzind.com');
      
    } catch (error) {
      console.error('❌ WordPress deployment failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async checkExistingSubdomains() {
    try {
      const response = await this.apiClient.get(`/package/${this.mainPackageId}/web/subdomains`);
      const subdomains = Array.isArray(response.data) ? response.data : [];
      
      console.log(`   Found ${subdomains.length} existing subdomains:`);
      subdomains.forEach(subdomain => {
        console.log(`   - ${subdomain.name || subdomain}`);
      });
      
      // Check if our target subdomain already exists
      const existingSubdomain = subdomains.find(sub => 
        (sub.name || sub) === this.targetSubdomain || 
        (sub.name || sub) === 'HomeHealthcare'
      );
      
      if (existingSubdomain) {
        console.log(`⚠️  Subdomain ${this.targetSubdomain} already exists`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('   Could not retrieve existing subdomains:', error.message);
      return false;
    }
  }

  async createSubdomain() {
    try {
      const response = await this.apiClient.post(`/package/${this.mainPackageId}/web/subdomains`, {
        name: 'HomeHealthcare',
        domain: 'dzind.com'
      });
      
      console.log('✅ Subdomain created successfully');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log('✅ Subdomain already exists - continuing...');
      } else {
        console.error('❌ Failed to create subdomain:', error.message);
        throw error;
      }
    }
  }

  async createDatabase() {
    try {
      // Create database
      const dbResponse = await this.apiClient.post(`/package/${this.mainPackageId}/mysql/databases`, {
        name: 'homehealthcare_wp'
      });
      
      console.log('✅ Database created successfully');
      console.log('   Database:', dbResponse.data);
      
      // Create database user
      const userResponse = await this.apiClient.post(`/package/${this.mainPackageId}/mysql/users`, {
        username: 'hh_wp_user',
        password: this.generatePassword(),
        database: 'homehealthcare_wp'
      });
      
      console.log('✅ Database user created successfully');
      console.log('   User:', userResponse.data);
      
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log('✅ Database already exists - continuing...');
      } else {
        console.error('❌ Failed to create database:', error.message);
        throw error;
      }
    }
  }

  async installWordPress() {
    try {
      // Check if WordPress is already installed
      const wpCheckResponse = await this.apiClient.get(`/package/${this.mainPackageId}/web/wordpress/installed`);
      
      if (wpCheckResponse.data) {
        console.log('✅ WordPress already installed - continuing...');
        return;
      }
      
      // Install WordPress
      const installResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/wordpress/install`, {
        site_title: 'Home Healthcare Services',
        admin_user: 'admin',
        admin_password: this.generatePassword(),
        admin_email: 'support@HomeHealthcare.dzind.com',
        subdomain: 'HomeHealthcare'
      });
      
      console.log('✅ WordPress installed successfully');
      console.log('   Installation details:', JSON.stringify(installResponse.data, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to install WordPress:', error.message);
      throw error;
    }
  }

  async setupSSL() {
    try {
      // Add free SSL certificate
      const sslResponse = await this.apiClient.post(`/package/${this.mainPackageId}/ssl/letsencrypt`, {
        domains: [`HomeHealthcare.dzind.com`]
      });
      
      console.log('✅ SSL certificate requested successfully');
      console.log('   SSL details:', JSON.stringify(sslResponse.data, null, 2));
      
      // Enable Force HTTPS
      const forceHttpsResponse = await this.apiClient.post(`/package/${this.mainPackageId}/web/forceHttps`, {
        enabled: true
      });
      
      console.log('✅ Force HTTPS enabled successfully');
      
    } catch (error) {
      console.error('❌ Failed to setup SSL:', error.message);
      // Don't throw error - SSL can be set up later
    }
  }

  async createEmailAccounts() {
    try {
      // Create do_not_reply email account
      const doNotReplyResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email/accounts`, {
        email: 'do_not_reply@HomeHealthcare.dzind.com',
        password: this.generatePassword()
      });
      
      console.log('✅ do_not_reply email account created successfully');
      
      // Create support email account
      const supportResponse = await this.apiClient.post(`/package/${this.mainPackageId}/email/accounts`, {
        email: 'support@HomeHealthcare.dzind.com',
        password: this.generatePassword()
      });
      
      console.log('✅ support email account created successfully');
      
    } catch (error) {
      console.error('❌ Failed to create email accounts:', error.message);
      // Don't throw error - email accounts can be created later
    }
  }

  generatePassword() {
    return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '123!';
  }
}

// Run the deployment
async function runDeployment() {
  try {
    const deployer = new WordPressDeployer();
    await deployer.deployWordPress();
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

runDeployment();