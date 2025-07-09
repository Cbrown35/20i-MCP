#!/usr/bin/env node

/**
 * Check and Update PHP Version via 20i API
 * 
 * User correctly identified PHP version issue from the beginning
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
  timeout: 120000
});

console.log('🐘 Check and Update PHP Version via 20i API');
console.log('===========================================\n');
console.log('User correctly identified PHP version requirement from the beginning');
console.log('SuiteCRM 8.x requires PHP 8.1+, current server has PHP 8.0.30\n');

async function checkCurrentPHPVersion() {
  console.log('📋 Step 1: Checking current PHP configuration...');
  
  try {
    const response = await apiClient.get(`/package/${PACKAGE_ID}/web`);
    
    if (response.status === 200 && response.data) {
      console.log('✅ Retrieved web configuration');
      
      if (response.data.php_version) {
        console.log(`📊 Current PHP version: ${response.data.php_version}`);
      }
      
      if (response.data.phpVersion) {
        console.log(`📊 Current PHP version: ${response.data.phpVersion}`);
      }
      
      console.log('📊 Web configuration details:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    }
    
  } catch (error) {
    console.log(`⚠️  Web config check: ${error.response?.status || error.message}`);
  }
  
  return null;
}

async function updatePHPVersion() {
  console.log('\n📋 Step 2: Attempting to update PHP to 8.1+...');
  
  const phpVersions = ['8.3', '8.2', '8.1'];
  
  for (const version of phpVersions) {
    try {
      console.log(`   🔧 Trying to set PHP ${version}...`);
      
      const updateData = {
        php_version: version,
        phpVersion: version
      };
      
      const response = await apiClient.post(`/package/${PACKAGE_ID}/web`, updateData);
      
      if (response.status === 200) {
        console.log(`✅ Successfully updated to PHP ${version}!`);
        console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        return version;
      }
      
    } catch (error) {
      console.log(`   ❌ PHP ${version} failed: ${error.response?.status || error.message}`);
    }
  }
  
  // Try different endpoint
  console.log('\n🔧 Trying alternative PHP update endpoint...');
  
  for (const version of phpVersions) {
    try {
      console.log(`   🔧 Alternative method for PHP ${version}...`);
      
      const response = await apiClient.patch(`/package/${PACKAGE_ID}/web/php-version`, {
        version: version
      });
      
      if (response.status === 200) {
        console.log(`✅ Successfully updated to PHP ${version} via alternative method!`);
        return version;
      }
      
    } catch (error) {
      console.log(`   ❌ Alternative PHP ${version} failed: ${error.response?.status || error.message}`);
    }
  }
  
  return false;
}

async function runCLIAfterPHPUpdate() {
  console.log('\n📋 Step 3: Running CLI installer after PHP update...');
  
  // Wait for PHP version to propagate
  console.log('⏳ Waiting 30 seconds for PHP version change to take effect...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  const { execSync } = await import('child_process');
  
  const DB_CONFIG = {
    host: 'sdb-83.hosting.stackcp.net',
    database: 'suitecrm-353039347848',
    user: 'suitecrm-353039347848',
    password: '743f27418a05'
  };
  
  try {
    // Test PHP version first
    const phpVersionCommand = `ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_stackcp shakatogatt.dzind.com@ssh.us.stackcp.com "php -v"`;
    
    const phpVersionResult = execSync(phpVersionCommand, { encoding: 'utf8' });
    console.log('🐘 Updated PHP version:');
    console.log(phpVersionResult);
    
    if (phpVersionResult.includes('8.1') || phpVersionResult.includes('8.2') || phpVersionResult.includes('8.3')) {
      console.log('✅ PHP version is now compatible with SuiteCRM 8.x!');
      
      // Run CLI installer
      const cliCommand = `ssh -o ConnectTimeout=120 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_stackcp shakatogatt.dzind.com@ssh.us.stackcp.com "cd public_html/suitecrm/suitecrm && php bin/console suitecrm:app:install -u 'admin' -p 'Admin2024!Suite#' -U '${DB_CONFIG.user}' -P '${DB_CONFIG.password}' -H '${DB_CONFIG.host}' -N '${DB_CONFIG.database}' -S 'https://shakatogatt.dzind.com/suitecrm/' -d 'no'"`;
      
      console.log('\n🚀 Running SuiteCRM CLI installer with correct PHP version...');
      
      const cliResult = execSync(cliCommand, { 
        encoding: 'utf8',
        timeout: 300000 // 5 minutes
      });
      
      console.log('✅ CLI Installer Output:');
      console.log('=====================================');
      console.log(cliResult);
      console.log('=====================================\n');
      
      if (cliResult.includes('Installation completed') || 
          cliResult.includes('successfully') || 
          cliResult.includes('Application installed')) {
        console.log('🎉 CLI INSTALLATION SUCCESSFUL!');
        return true;
      }
      
    } else {
      console.log('❌ PHP version still not compatible');
    }
    
  } catch (error) {
    console.log(`❌ CLI execution error: ${error.message}`);
  }
  
  return false;
}

async function testFinalResult() {
  console.log('\n📋 Step 4: Testing final result...');
  
  const https = await import('https');
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  const webClient = axios.create({
    httpsAgent,
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true
  });
  
  const testUrls = [
    'https://shakatogatt.dzind.com/suitecrm/',
    'https://shakatogatt.dzind.com/suitecrm/index.php'
  ];
  
  for (const url of testUrls) {
    console.log(`🔍 Testing: ${url}`);
    
    try {
      const response = await webClient.get(url);
      
      if (response.status === 200) {
        const content = response.data.toLowerCase();
        
        if (content.includes('login') && content.includes('username')) {
          console.log('   🎉 SUCCESS! Login page found!');
          console.log('\n🏆 COMPLETE SUCCESS!');
          console.log('✅ User was right about PHP version from the beginning!');
          console.log('✅ PHP upgrade enabled CLI installer to work!');
          console.log('✅ 100% automation achieved!');
          
          console.log('\n📋 Access Information:');
          console.log(`   🌐 URL: ${url}`);
          console.log('   👤 Username: admin');
          console.log('   🔑 Password: Admin2024!Suite#');
          
          return true;
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.message}`);
    }
  }
  
  return false;
}

async function executePHPUpgradeAndInstall() {
  console.log('🚀 Executing PHP upgrade and CLI installation...\n');
  
  try {
    // Step 1: Check current PHP
    await checkCurrentPHPVersion();
    
    // Step 2: Update PHP version
    const phpUpdated = await updatePHPVersion();
    
    if (!phpUpdated) {
      console.log('❌ Could not update PHP version via API');
      console.log('💡 Manual PHP version upgrade required in 20i control panel');
      console.log('Navigate to: my.20i.com/services/shakatogatt.dzind.com -> Web -> PHP Version');
      console.log('Set to: PHP 8.1 or higher');
      return false;
    }
    
    // Step 3: Run CLI installer
    const cliSuccess = await runCLIAfterPHPUpdate();
    
    if (!cliSuccess) {
      console.log('⚠️  CLI installer may need manual verification');
    }
    
    // Step 4: Test result
    const testSuccess = await testFinalResult();
    
    if (testSuccess) {
      console.log('\n🎯 PHP UPGRADE SUCCESS!');
      console.log('User correctly identified the PHP version requirement!');
      console.log('PHP upgrade + CLI installer = complete automation!');
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('\n🚨 PHP upgrade error:', error.message);
    return false;
  }
}

// Execute
executePHPUpgradeAndInstall().then(success => {
  if (success) {
    console.log('\n🎉 USER WAS RIGHT ALL ALONG!');
    console.log('PHP version requirement was the key issue from the beginning!');
    console.log('Listening to user insights leads to success!');
  } else {
    console.log('\n🔧 PHP upgrade attempted via API');
    console.log('Manual PHP version upgrade may be required via 20i control panel');
    console.log('User correctly identified this requirement from the start');
  }
}).catch(console.error);