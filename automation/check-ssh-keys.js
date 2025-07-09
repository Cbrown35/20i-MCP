#!/usr/bin/env node

/**
 * Check SSH Key Management via 20i API
 * 
 * Look for SSH key functionality and SSH access endpoints
 */

import axios from 'axios';

const API_KEY = 'REDACTED_LEAKED_20I_API_KEY';
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

console.log('🔍 Checking SSH Key Management via 20i API');
console.log('==========================================\n');

// Check SSH key management endpoints
async function checkSSHKeyEndpoints() {
  console.log('📋 Step 1: Checking SSH key management endpoints...');
  
  const sshKeyEndpoints = [
    `/package/${PACKAGE_ID}/ssh/keys`,
    `/package/${PACKAGE_ID}/sshKeys`,
    `/package/${PACKAGE_ID}/web/ssh/keys`,
    `/package/${PACKAGE_ID}/web/sshKeys`,
    `/ssh/keys`,
    `/sshKeys`,
    `/package/${PACKAGE_ID}/linux/ssh`,
    `/package/${PACKAGE_ID}/linux/sshKeys`
  ];
  
  for (const endpoint of sshKeyEndpoints) {
    console.log(`🔍 Testing: ${endpoint}`);
    
    try {
      const response = await apiClient.get(endpoint);
      
      if (response.status === 200) {
        console.log(`✅ SSH keys endpoint found: ${endpoint}`);
        console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}`);
        return { found: true, endpoint, data: response.data };
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { found: false };
}

// Check SSH access endpoints
async function checkSSHAccessEndpoints() {
  console.log('\n📋 Step 2: Checking SSH access endpoints...');
  
  const sshAccessEndpoints = [
    `/package/${PACKAGE_ID}/ssh`,
    `/package/${PACKAGE_ID}/ssh/access`,
    `/package/${PACKAGE_ID}/ssh/info`,
    `/package/${PACKAGE_ID}/linux/ssh`,
    `/package/${PACKAGE_ID}/web/ssh`,
    `/package/${PACKAGE_ID}/stackcp/ssh`
  ];
  
  for (const endpoint of sshAccessEndpoints) {
    console.log(`🔍 Testing: ${endpoint}`);
    
    try {
      const response = await apiClient.get(endpoint);
      
      if (response.status === 200) {
        console.log(`✅ SSH access endpoint found: ${endpoint}`);
        console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}`);
        return { found: true, endpoint, data: response.data };
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { found: false };
}

// Check StackCP specific endpoints
async function checkStackCPEndpoints() {
  console.log('\n📋 Step 3: Checking StackCP specific endpoints...');
  
  const stackcpEndpoints = [
    `/package/${PACKAGE_ID}/stackcp`,
    `/package/${PACKAGE_ID}/stackcp/ssh`,
    `/package/${PACKAGE_ID}/stackcp/terminal`,
    `/stackcp/${PACKAGE_ID}`,
    `/stackcp/${PACKAGE_ID}/ssh`,
    `/services/stackcp/ssh`
  ];
  
  for (const endpoint of stackcpEndpoints) {
    console.log(`🔍 Testing: ${endpoint}`);
    
    try {
      const response = await apiClient.get(endpoint);
      
      if (response.status === 200) {
        console.log(`✅ StackCP endpoint found: ${endpoint}`);
        console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}`);
        return { found: true, endpoint, data: response.data };
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { found: false };
}

// Generate SSH key pair
async function generateSSHKey() {
  console.log('\n📋 Step 4: Attempting to generate SSH key...');
  
  const keyGenEndpoints = [
    `/package/${PACKAGE_ID}/ssh/generateKey`,
    `/package/${PACKAGE_ID}/sshKeys/generate`,
    `/ssh/generate`,
    `/sshKeys/generate`
  ];
  
  for (const endpoint of keyGenEndpoints) {
    console.log(`🔍 Testing key generation: ${endpoint}`);
    
    try {
      const response = await apiClient.post(endpoint, {
        name: 'suitecrm-config-key',
        type: 'rsa',
        comment: 'SuiteCRM configuration key'
      });
      
      if (response.status === 200) {
        console.log(`✅ SSH key generation successful: ${endpoint}`);
        console.log(`📊 Key info: ${JSON.stringify(response.data, null, 2)}`);
        return { success: true, endpoint, keyData: response.data };
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { success: false };
}

// Check existing SSH keys
async function listSSHKeys() {
  console.log('\n📋 Step 5: Listing existing SSH keys...');
  
  const listEndpoints = [
    `/package/${PACKAGE_ID}/ssh/keys`,
    `/package/${PACKAGE_ID}/sshKeys`,
    `/ssh/keys`,
    `/sshKeys`
  ];
  
  for (const endpoint of listEndpoints) {
    console.log(`🔍 Listing keys: ${endpoint}`);
    
    try {
      const response = await apiClient.get(endpoint);
      
      if (response.status === 200 && response.data) {
        console.log(`✅ SSH keys found: ${endpoint}`);
        
        if (Array.isArray(response.data)) {
          console.log(`📊 Found ${response.data.length} SSH keys:`);
          response.data.forEach((key, index) => {
            console.log(`   ${index + 1}. ${key.name || key.id || 'Unknown'} (${key.type || 'unknown type'})`);
          });
        } else {
          console.log(`📊 SSH key data: ${JSON.stringify(response.data, null, 2)}`);
        }
        
        return { found: true, endpoint, keys: response.data };
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { found: false };
}

// Check SSH connection info
async function getSSHConnectionInfo() {
  console.log('\n📋 Step 6: Getting SSH connection information...');
  
  const connectionEndpoints = [
    `/package/${PACKAGE_ID}/ssh/connection`,
    `/package/${PACKAGE_ID}/ssh/info`,
    `/package/${PACKAGE_ID}/connection`,
    `/package/${PACKAGE_ID}`,
    `/package/${PACKAGE_ID}/web`
  ];
  
  for (const endpoint of connectionEndpoints) {
    console.log(`🔍 Getting connection info: ${endpoint}`);
    
    try {
      const response = await apiClient.get(endpoint);
      
      if (response.status === 200 && response.data) {
        console.log(`✅ Connection info found: ${endpoint}`);
        
        const data = response.data;
        
        // Look for SSH-related info
        const sshInfo = {};
        
        if (data.sshHost || data.ssh_host) {
          sshInfo.host = data.sshHost || data.ssh_host;
        }
        if (data.sshPort || data.ssh_port) {
          sshInfo.port = data.sshPort || data.ssh_port;
        }
        if (data.sshUser || data.ssh_user || data.username) {
          sshInfo.user = data.sshUser || data.ssh_user || data.username;
        }
        
        if (Object.keys(sshInfo).length > 0) {
          console.log(`📊 SSH Connection Info:`, sshInfo);
          return { found: true, sshInfo, data };
        } else {
          // Look for any SSH-related keys in the response
          const keys = Object.keys(data).filter(key => 
            key.toLowerCase().includes('ssh') || 
            key.toLowerCase().includes('host') ||
            key.toLowerCase().includes('user')
          );
          
          if (keys.length > 0) {
            console.log(`📊 Potential SSH-related fields:`, keys);
            console.log(`📊 Data: ${JSON.stringify(data, null, 2)}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ${error.response?.status || error.message}`);
    }
  }
  
  return { found: false };
}

// Main SSH investigation
async function runSSHInvestigation() {
  console.log('🚀 Starting comprehensive SSH investigation...\n');
  
  try {
    // Step 1: Check SSH key management
    const keyCheck = await checkSSHKeyEndpoints();
    
    // Step 2: Check SSH access endpoints
    const accessCheck = await checkSSHAccessEndpoints();
    
    // Step 3: Check StackCP endpoints
    const stackcpCheck = await checkStackCPEndpoints();
    
    // Step 4: List existing SSH keys
    const keysList = await listSSHKeys();
    
    // Step 5: Get connection info
    const connectionInfo = await getSSHConnectionInfo();
    
    // Step 6: Try to generate a key if management is available
    let keyGen = { success: false };
    if (keyCheck.found) {
      keyGen = await generateSSHKey();
    }
    
    // Summary
    console.log('\n📋 SSH Investigation Summary');
    console.log('============================');
    
    if (keyCheck.found || accessCheck.found || stackcpCheck.found) {
      console.log('✅ SSH functionality available via API!');
      
      if (keyCheck.found) {
        console.log(`✅ SSH key management: ${keyCheck.endpoint}`);
      }
      if (accessCheck.found) {
        console.log(`✅ SSH access: ${accessCheck.endpoint}`);
      }
      if (stackcpCheck.found) {
        console.log(`✅ StackCP SSH: ${stackcpCheck.endpoint}`);
      }
      if (connectionInfo.found) {
        console.log('✅ SSH connection info available');
      }
      
      return { 
        available: true, 
        keyManagement: keyCheck.found,
        sshAccess: accessCheck.found,
        stackcp: stackcpCheck.found,
        connectionInfo: connectionInfo.found
      };
    } else {
      console.log('❌ No SSH functionality found via API');
      console.log('Manual StackCP interface remains the recommended approach');
      return { available: false };
    }
    
  } catch (error) {
    console.error('\n🚨 SSH investigation error:', error.message);
    return { available: false, error: true };
  }
}

// Execute SSH investigation
runSSHInvestigation().then(result => {
  if (result.available) {
    console.log('\n🎯 Excellent! SSH functionality is available!');
    console.log('We can potentially complete the SuiteCRM configuration via SSH');
    
    if (result.keyManagement) {
      console.log('✅ Can manage SSH keys via API');
    }
    if (result.sshAccess) {
      console.log('✅ Can access SSH via API');
    }
    if (result.stackcp) {
      console.log('✅ StackCP SSH integration available');
    }
    
    console.log('\n📋 Next: Set up SSH access and complete database configuration');
  } else {
    console.log('\n📋 SSH via API not available');
    console.log('Recommend using StackCP web interface for SSH key setup');
    console.log('Then we can SSH directly to complete the configuration');
  }
}).catch(console.error);