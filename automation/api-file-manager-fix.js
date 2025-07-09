#!/usr/bin/env node

/**
 * Complete SuiteCRM Database Configuration via 20i API
 * 
 * Try all possible file management endpoints to create/edit config
 */

import axios from 'axios';

const API_KEY = process.env.TWENTYI_API_KEY || process.env.TWENTYI_COMBINED_KEY;

if (!API_KEY) {
  console.error('❌ Missing required environment variable: TWENTYI_API_KEY or TWENTYI_COMBINED_KEY');
  process.exit(1);
}
const PACKAGE_ID = '3302301';

const authHeader = `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
const apiClient = axios.create({
  baseURL: 'https://api.20i.com',
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
  },
  timeout: 60000
});

console.log('🔧 Completing SuiteCRM Database Configuration via API');
console.log('===================================================\n');

// SuiteCRM configuration content
const CONFIG_CONTENT = `<?php
if(!defined('sugarEntry') || !sugarEntry) die('Not A Valid Entry Point');

$sugar_config['dbconfig']['db_host_name'] = 'localhost';
$sugar_config['dbconfig']['db_user_name'] = 'shakatogatt_user';
$sugar_config['dbconfig']['db_password'] = 'Suite2024!DB#Secure';
$sugar_config['dbconfig']['db_name'] = 'shakatogatt_suite-353039349811';
$sugar_config['dbconfig']['db_type'] = 'mysql';
$sugar_config['dbconfig']['db_port'] = '3306';
$sugar_config['dbconfig']['db_manager'] = 'MysqliManager';

$sugar_config['site_url'] = 'https://shakatogatt.dzind.com';
$sugar_config['host_name'] = 'shakatogatt.dzind.com';
$sugar_config['installer_locked'] = true;
$sugar_config['disable_export'] = false;
$sugar_config['disable_persistent_connections'] = false;

$sugar_config['dbconfigoption']['persistent'] = true;
$sugar_config['dbconfigoption']['autofree'] = false;
$sugar_config['dbconfigoption']['debug'] = 0;
$sugar_config['dbconfigoption']['ssl'] = false;

$sugar_config['cache_dir'] = 'cache/';
$sugar_config['log_dir'] = 'logs/';
$sugar_config['tmp_dir'] = 'cache/xml/';
$sugar_config['upload_dir'] = 'upload/';
$sugar_config['upload_maxsize'] = 30000000;
$sugar_config['unique_key'] = 'auto_generated_${Date.now()}';

$sugar_config['default_theme'] = 'SuiteP';
$sugar_config['default_language'] = 'en_us';
$sugar_config['default_charset'] = 'UTF-8';
?>`;

// Try comprehensive file creation methods
async function tryFileCreation() {
  console.log('📋 Attempting file creation via multiple API methods...\n');
  
  const filePaths = [
    'public_html/suitecrm/config_override.php',
    'public_html/suitecrm/config.php',
    'public_html/suitecrm/legacy/config.php',
    'suitecrm/config_override.php',
    'suitecrm/config.php'
  ];
  
  const createMethods = [
    {
      name: 'Package Web Manager',
      method: 'POST',
      endpoint: `/package/${PACKAGE_ID}/web`,
      dataFormat: (path, content) => ({
        action: 'createFile',
        path: path,
        content: content,
        fileName: path.split('/').pop()
      })
    },
    {
      name: 'Web Package Files',
      method: 'PUT',
      endpoint: `/package/${PACKAGE_ID}/web/files`,
      dataFormat: (path, content) => ({
        path: path,
        content: content,
        action: 'create'
      })
    },
    {
      name: 'File Manager Direct',
      method: 'POST',
      endpoint: `/package/${PACKAGE_ID}/fileManager`,
      dataFormat: (path, content) => ({
        action: 'create',
        file: path,
        content: content
      })
    },
    {
      name: 'StackCP Files',
      method: 'POST',
      endpoint: `/stackcp/${PACKAGE_ID}/files`,
      dataFormat: (path, content) => ({
        create: path,
        data: content
      })
    },
    {
      name: 'Web Root Manager',
      method: 'POST',
      endpoint: `/package/${PACKAGE_ID}/web/root`,
      dataFormat: (path, content) => ({
        file: path,
        content: content,
        operation: 'create'
      })
    }
  ];
  
  for (const filePath of filePaths) {
    console.log(`🔍 Trying to create: ${filePath}`);
    
    for (const method of createMethods) {
      console.log(`   📤 Method: ${method.name}`);
      
      try {
        let response;
        const data = method.dataFormat(filePath, CONFIG_CONTENT);
        
        if (method.method === 'POST') {
          response = await apiClient.post(method.endpoint, data);
        } else if (method.method === 'PUT') {
          response = await apiClient.put(method.endpoint, data);
        }
        
        if (response && response.status === 200) {
          console.log(`     ✅ SUCCESS! File created via ${method.name}`);
          console.log(`     📊 Response: ${JSON.stringify(response.data)}`);
          return { success: true, method: method.name, path: filePath };
        }
        
      } catch (error) {
        console.log(`     ❌ ${error.response?.status || error.message}`);
      }
    }
    console.log('');
  }
  
  return { success: false };
}

// Try alternative approaches using discovered endpoints
async function tryAlternativeApproaches() {
  console.log('📋 Trying alternative configuration approaches...\n');
  
  // Method 1: Try to use the FTP credentials to upload via API
  console.log('🔍 Method 1: FTP-based file upload');
  try {
    const ftpUpload = await apiClient.post(`/package/${PACKAGE_ID}/web/ftpUpload`, {
      username: 'shakatogatt.dzind.com',
      password: 'TE&bc$fz&3ZK',
      file: 'config_override.php',
      path: 'public_html/suitecrm/',
      content: Buffer.from(CONFIG_CONTENT).toString('base64')
    });
    
    if (ftpUpload.status === 200) {
      console.log('✅ FTP upload successful!');
      return { success: true, method: 'FTP Upload' };
    }
  } catch (error) {
    console.log(`❌ FTP upload failed: ${error.response?.status || error.message}`);
  }
  
  // Method 2: Try backup/restore with custom config
  console.log('\n🔍 Method 2: Backup with config injection');
  try {
    const backupConfig = await apiClient.post(`/package/${PACKAGE_ID}/web/backup`, {
      type: 'custom',
      includeFiles: true,
      includeDatabases: true,
      customFiles: {
        'public_html/suitecrm/config_override.php': CONFIG_CONTENT
      }
    });
    
    if (backupConfig.status === 200) {
      console.log('✅ Backup with config injection successful!');
      return { success: true, method: 'Backup Config Injection' };
    }
  } catch (error) {
    console.log(`❌ Backup config injection failed: ${error.response?.status || error.message}`);
  }
  
  // Method 3: Try to use the application reinstall with config
  console.log('\n🔍 Method 3: Application update with config');
  try {
    const appUpdate = await apiClient.post(`/package/${PACKAGE_ID}/web/oneClickUpdate`, {
      application: 'suitecrm',
      domain: 'shakatogatt.dzind.com',
      updateConfig: true,
      configFiles: {
        'config_override.php': CONFIG_CONTENT
      }
    });
    
    if (appUpdate.status === 200) {
      console.log('✅ Application update with config successful!');
      return { success: true, method: 'Application Update' };
    }
  } catch (error) {
    console.log(`❌ Application update failed: ${error.response?.status || error.message}`);
  }
  
  return { success: false };
}

// Test if configuration was successful
async function testConfiguration() {
  console.log('\n📋 Testing SuiteCRM after configuration...\n');
  
  // Wait for changes to take effect
  console.log('⏳ Waiting 30 seconds for configuration to take effect...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  const testUrls = [
    'https://shakatogatt.dzind.com/',
    'https://shakatogatt.dzind.com/index.php'
  ];
  
  const https = await import('https');
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const webClient = axios.create({ httpsAgent, timeout: 15000 });
  
  for (const url of testUrls) {
    console.log(`   Testing: ${url}`);
    
    try {
      const response = await webClient.get(url);
      
      if (response.status === 200) {
        const content = response.data.toLowerCase();
        
        if (content.includes('login') && content.includes('username')) {
          console.log(`     🎉 SUCCESS! SuiteCRM login page found!`);
          console.log('\n🏆 100% AUTOMATION ACHIEVED!');
          console.log('\n📋 SuiteCRM Access Information:');
          console.log(`   🌐 URL: ${url}`);
          console.log('   👤 Username: admin');
          console.log('   🔑 Password: Admin2024!Suite#');
          console.log('   📧 Email: admin@shakatogatt.dzind.com');
          return { success: true, loginUrl: url };
        } else if (!content.includes('fatal error') && !content.includes('mysqli_connect')) {
          console.log(`     ✅ No database errors - configuration may be working`);
        } else {
          console.log(`     ⚠️  Still has database connection issues`);
        }
      }
      
    } catch (error) {
      if (error.response?.status === 500) {
        console.log(`     💥 Still showing 500 error`);
      } else {
        console.log(`     ❌ ${error.response?.status || error.message}`);
      }
    }
  }
  
  return { success: false };
}

// Main execution
async function completeViaAPI() {
  console.log('🚀 Starting API-based configuration completion...\n');
  
  try {
    // Step 1: Try direct file creation
    const fileResult = await tryFileCreation();
    
    if (fileResult.success) {
      console.log(`\n✅ File creation successful via ${fileResult.method}!`);
      
      const testResult = await testConfiguration();
      
      if (testResult.success) {
        console.log('\n🎯 MISSION ACCOMPLISHED!');
        console.log('100% SuiteCRM automation completed via 20i APIs!');
        return true;
      }
    }
    
    // Step 2: Try alternative approaches
    console.log('\n📋 Trying alternative configuration methods...');
    const altResult = await tryAlternativeApproaches();
    
    if (altResult.success) {
      console.log(`\n✅ Configuration successful via ${altResult.method}!`);
      
      const testResult = await testConfiguration();
      
      if (testResult.success) {
        console.log('\n🎯 MISSION ACCOMPLISHED!');
        console.log('100% SuiteCRM automation completed via 20i APIs!');
        return true;
      }
    }
    
    console.log('\n⚠️  API-based configuration methods exhausted');
    console.log('The file management endpoints may not be available in the current API version');
    console.log('Manual StackCP file manager or SSH access remains the recommended approach');
    
    return false;
    
  } catch (error) {
    console.error('\n🚨 API configuration error:', error.message);
    return false;
  }
}

// Execute
completeViaAPI().then(success => {
  if (success) {
    console.log('\n🎉 You were right - it was possible via API!');
    console.log('Complete automation achieved through 20i API endpoints!');
  } else {
    console.log('\n🔧 API file management not accessible');
    console.log('This indicates the API may not expose direct file system access');
    console.log('for security reasons (which is actually good practice)');
    console.log('\nRecommendation: Use StackCP web interface for the final step');
  }
}).catch(console.error);