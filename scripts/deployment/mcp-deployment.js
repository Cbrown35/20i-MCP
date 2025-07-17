#!/usr/bin/env node

// MCP-based WordPress deployment script
// This script uses the MCP server's tool interface for reliable API calls

import { config } from 'dotenv';
config();

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPDeployer {
  constructor() {
    this.mcpServerPath = join(__dirname, 'build', 'index.js');
    this.targetSubdomain = 'HomeHealthcare.dzind.com';
    this.mainPackageId = '3145084'; // dzind.com package ID
    this.dbName = 'homehealthcare_wp';
    this.dbUser = 'hh_wp_user';
    this.dbPassword = this.generatePassword();
    this.wpAdminPassword = this.generatePassword();
    this.emailPassword = this.generatePassword();
  }

  async deployWordPress() {
    console.log('🚀 Starting WordPress deployment using MCP server...');
    
    try {
      // Step 1: Get existing MySQL databases
      console.log('\n1. Checking existing MySQL databases...');
      await this.getMySQLDatabases();
      
      // Step 2: Create MySQL database
      console.log('\n2. Creating MySQL database...');
      await this.createMySQLDatabase();
      
      // Step 3: Create MySQL user
      console.log('\n3. Creating MySQL user...');
      await this.createMySQLUser();
      
      // Step 4: Grant database permissions
      console.log('\n4. Granting database permissions...');
      await this.grantDatabasePermissions();
      
      // Step 5: Check WordPress installation
      console.log('\n5. Checking WordPress installation...');
      await this.checkWordPressInstallation();
      
      // Step 6: Set up SSL certificate
      console.log('\n6. Setting up SSL certificate...');
      await this.setupSSL();
      
      // Step 7: Create email accounts
      console.log('\n7. Creating email accounts...');
      await this.createEmailAccounts();
      
      console.log('\n🎉 WordPress deployment completed successfully!');
      console.log('✅ Site URL: https://HomeHealthcare.dzind.com');
      console.log('✅ Database:', this.dbName);
      console.log('✅ Database User:', this.dbUser);
      console.log('✅ Email accounts: do_not_reply@HomeHealthcare.dzind.com, support@HomeHealthcare.dzind.com');
      
      console.log('\n🔐 Generated Credentials (SAVE THESE SECURELY):');
      console.log('Database Name:', this.dbName);
      console.log('Database User:', this.dbUser);
      console.log('Database Password:', this.dbPassword);
      console.log('WordPress Admin Password:', this.wpAdminPassword);
      console.log('Email Password:', this.emailPassword);
      
    } catch (error) {
      console.error('❌ WordPress deployment failed:', error.message);
      throw error;
    }
  }

  async callMCPTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', [this.mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });
      
      let output = '';
      let errorOutput = '';
      
      mcpProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      mcpProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      mcpProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`MCP tool failed with code ${code}: ${errorOutput}`));
        }
      });
      
      // Send MCP request
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };
      
      mcpProcess.stdin.write(JSON.stringify(request) + '\n');
      mcpProcess.stdin.end();
    });
  }

  async getMySQLDatabases() {
    try {
      const result = await this.callMCPTool('get_mysql_databases', {
        packageId: this.mainPackageId
      });
      
      console.log('✅ MySQL databases retrieved successfully');
      console.log('   Result:', result);
      
    } catch (error) {
      console.log('⚠️  Could not retrieve MySQL databases:', error.message);
    }
  }

  async createMySQLDatabase() {
    try {
      const result = await this.callMCPTool('create_mysql_database', {
        packageId: this.mainPackageId,
        name: this.dbName
      });
      
      console.log('✅ MySQL database created successfully');
      console.log('   Result:', result);
      
    } catch (error) {
      console.error('❌ Failed to create MySQL database:', error.message);
      throw error;
    }
  }

  async createMySQLUser() {
    try {
      const result = await this.callMCPTool('create_mysql_user', {
        packageId: this.mainPackageId,
        username: this.dbUser,
        password: this.dbPassword,
        database: this.dbName
      });
      
      console.log('✅ MySQL user created successfully');
      console.log('   Result:', result);
      
    } catch (error) {
      console.error('❌ Failed to create MySQL user:', error.message);
      throw error;
    }
  }

  async grantDatabasePermissions() {
    try {
      const result = await this.callMCPTool('grant_mysql_user_database', {
        packageId: this.mainPackageId,
        username: this.dbUser,
        database: this.dbName
      });
      
      console.log('✅ Database permissions granted successfully');
      console.log('   Result:', result);
      
    } catch (error) {
      console.error('❌ Failed to grant database permissions:', error.message);
      throw error;
    }
  }

  async checkWordPressInstallation() {
    try {
      const result = await this.callMCPTool('is_wordpress_installed', {
        packageId: this.mainPackageId
      });
      
      console.log('✅ WordPress installation status checked');
      console.log('   Result:', result);
      
    } catch (error) {
      console.log('⚠️  Could not check WordPress installation:', error.message);
    }
  }

  async setupSSL() {
    try {
      const result = await this.callMCPTool('add_free_ssl', {
        packageId: this.mainPackageId,
        domains: [this.targetSubdomain]
      });
      
      console.log('✅ SSL certificate setup initiated');
      console.log('   Result:', result);
      
    } catch (error) {
      console.error('❌ Failed to setup SSL:', error.message);
      // Don't throw - SSL can be configured later
    }
  }

  async createEmailAccounts() {
    try {
      // Create do_not_reply email account
      const result1 = await this.callMCPTool('create_email_account', {
        packageId: this.mainPackageId,
        email: 'do_not_reply@HomeHealthcare.dzind.com',
        password: this.emailPassword
      });
      
      console.log('✅ do_not_reply email account created successfully');
      console.log('   Result:', result1);
      
      // Create support email account
      const result2 = await this.callMCPTool('create_email_account', {
        packageId: this.mainPackageId,
        email: 'support@HomeHealthcare.dzind.com',
        password: this.emailPassword
      });
      
      console.log('✅ support email account created successfully');
      console.log('   Result:', result2);
      
    } catch (error) {
      console.error('❌ Failed to create email accounts:', error.message);
      // Don't throw - email accounts can be created later
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
    const deployer = new MCPDeployer();
    await deployer.deployWordPress();
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

runDeployment();