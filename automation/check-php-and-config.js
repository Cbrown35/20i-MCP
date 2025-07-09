#!/usr/bin/env node

/**
 * Check PHP Version and SuiteCRM Database Configuration
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

console.log('🔍 Checking PHP Version and SuiteCRM Configuration');
console.log('================================================\n');

// Check PHP version
async function checkPHPVersion() {
  console.log('📋 Step 1: Checking PHP version...');
  
  try {
    const response = await apiClient.get(`/package/${PACKAGE_ID}/web`);
    const webData = response.data;
    
    console.log('✅ Web package details retrieved');
    console.log(`📊 PHP Version: ${webData.phpVersion || 'Not specified'}`);
    console.log(`📊 Domain Count: ${webData.domains?.length || 0}`);
    
    if (webData.domains && webData.domains.length > 0) {
      console.log(`📊 Primary Domain: ${webData.domains[0]}`);
    }
    
    // Check if PHP version is compatible with SuiteCRM 8.x
    if (webData.phpVersion) {
      const version = webData.phpVersion;
      const majorVersion = parseInt(version.split('.')[0]);
      
      console.log(`\n🔍 SuiteCRM 8.x Compatibility Check:`);
      
      if (majorVersion >= 8) {
        console.log(`✅ PHP ${version} is compatible with SuiteCRM 8.x`);
        return { compatible: true, version: version };
      } else {
        console.log(`❌ PHP ${version} is too old for SuiteCRM 8.x`);
        console.log(`🔧 SuiteCRM 8.x requires PHP 8.0 or higher`);
        return { compatible: false, version: version, needsUpdate: true };
      }
    } else {
      console.log('⚠️  PHP version not detected, checking configuration files...');
      return { compatible: undefined, version: null };
    }
    
  } catch (error) {
    console.log(`❌ Failed to get web package details: ${error.response?.status} - ${error.message}`);
    return { error: true };
  }
}

// Get file manager access to check SuiteCRM config
async function checkSuiteCRMConfig() {
  console.log('\n📋 Step 2: Checking SuiteCRM configuration files...');
  
  // Try to access file manager API to check config files
  const configPaths = [
    '/public_html/suitecrm/.env',
    '/public_html/suitecrm/config.php',
    '/public_html/suitecrm/suitecrm/.env',
    '/public_html/suitecrm/suitecrm/config.php',
    '/public_html/suitecrm/legacy/config.php'
  ];
  
  for (const configPath of configPaths) {
    console.log(`🔍 Checking: ${configPath}`);
    
    try {
      // Try to read file via file manager API
      const response = await apiClient.get(`/package/${PACKAGE_ID}/web/fileManager`, {
        params: { path: configPath }
      });
      
      if (response.status === 200) {
        console.log(`✅ Found config file: ${configPath}`);
        return { found: true, path: configPath, data: response.data };
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || 'Not found'}`);
    }
  }
  
  console.log('⚠️  No config files accessible via API');
  return { found: false };
}

// Check available PHP versions
async function checkAvailablePHPVersions() {
  console.log('\n📋 Step 3: Checking available PHP versions...');
  
  try {
    // Try to get available PHP versions
    const response = await apiClient.get(`/package/${PACKAGE_ID}/web/phpVersions`);
    
    if (response.data && Array.isArray(response.data)) {
      console.log('✅ Available PHP versions:');
      response.data.forEach(version => {
        console.log(`   - PHP ${version}`);
      });
      
      const php8Versions = response.data.filter(v => v.startsWith('8.'));
      if (php8Versions.length > 0) {
        console.log(`\n🎯 Recommended for SuiteCRM 8.x: PHP ${php8Versions[php8Versions.length - 1]}`);
        return { available: response.data, recommended: php8Versions[php8Versions.length - 1] };
      }
    }
    
  } catch (error) {
    console.log(`❌ Could not get PHP versions: ${error.response?.status} - ${error.message}`);
  }
  
  return { available: [] };
}

// Update PHP version if needed
async function updatePHPVersion(targetVersion) {
  console.log(`\n📋 Step 4: Updating to PHP ${targetVersion}...`);
  
  try {
    const response = await apiClient.post(`/package/${PACKAGE_ID}/web/phpVersion`, {
      phpVersion: targetVersion
    });
    
    if (response.status === 200) {
      console.log(`✅ PHP version updated to ${targetVersion}`);
      console.log('⏳ Changes may take 1-2 minutes to take effect');
      return { success: true };
    }
    
  } catch (error) {
    console.log(`❌ Failed to update PHP version: ${error.response?.status} - ${error.message}`);
    return { success: false };
  }
}

// Main execution
async function runPHPCheck() {
  console.log('🚀 Starting PHP and configuration check...\n');
  
  try {
    // Step 1: Check current PHP version
    const phpCheck = await checkPHPVersion();
    
    if (phpCheck.error) {
      console.log('\n❌ Cannot proceed without web package access');
      return false;
    }
    
    // Step 2: Check config files
    const configCheck = await checkSuiteCRMConfig();
    
    // Step 3: Check available PHP versions
    const versionsCheck = await checkAvailablePHPVersions();
    
    // Step 4: Update PHP if needed and possible
    if (phpCheck.needsUpdate && versionsCheck.recommended) {
      const updateResult = await updatePHPVersion(versionsCheck.recommended);
      
      if (updateResult.success) {
        console.log('\n🎉 PHP version updated successfully!');
        console.log('Now we can proceed with database configuration fix');
        return true;
      }
    } else if (phpCheck.compatible) {
      console.log('\n✅ PHP version is compatible, proceeding with database fix');
      return true;
    }
    
    console.log('\n📋 Next: Fix SuiteCRM database configuration');
    return true;
    
  } catch (error) {
    console.error('\n🚨 PHP check error:', error.message);
    return false;
  }
}

runPHPCheck().then(success => {
  if (success) {
    console.log('\n🎯 PHP check completed - ready for database configuration fix');
  } else {
    console.log('\n🔧 Manual PHP version check may be needed');
  }
}).catch(console.error);