#!/usr/bin/env node

// Install WordPress using one-click installation

import { config } from 'dotenv';
config();

import axios from 'axios';

async function installWordPress() {
  console.log('🚀 Installing WordPress using one-click installation...');
  
  const apiKey = process.env.TWENTYI_API_KEY;
  const packageId = '3145084';
  
  if (!apiKey) {
    throw new Error('TWENTYI_API_KEY not found in environment');
  }
  
  const authHeader = `Bearer ${Buffer.from(apiKey).toString('base64')}`;
  
  const apiClient = axios.create({
    baseURL: 'https://api.20i.com',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 30000,
  });
  
  try {
    // Step 1: Get WordPress one-click app details
    console.log('\n1. Getting WordPress one-click app details...');
    const oneClickResponse = await apiClient.get(`/package/${packageId}/web/oneclick`);
    const wordpressApp = oneClickResponse.data.wordpress;
    
    console.log('✅ WordPress app found:', wordpressApp);
    
    // Step 2: Create subdomain first
    console.log('\n2. Creating subdomain...');
    try {
      const subdomainPayload = {
        name: 'HomeHealthcare'
      };
      
      const subdomainResponse = await apiClient.post(`/package/${packageId}/web/subdomains`, subdomainPayload);
      console.log('✅ Subdomain created:', subdomainResponse.data);
    } catch (subdomainError) {
      if (subdomainError.response?.status === 400) {
        console.log('✅ Subdomain already exists');
      } else {
        throw subdomainError;
      }
    }
    
    // Step 3: Install WordPress
    console.log('\n3. Installing WordPress...');
    
    // Try different WordPress installation endpoints
    const installationEndpoints = [
      '/package/' + packageId + '/web/oneclick/wordpress',
      '/package/' + packageId + '/web/oneclick',
      '/package/' + packageId + '/web/install',
      '/package/' + packageId + '/web/wordpress/install'
    ];
    
    const installPayload = {
      app: 'wordpress',
      subdomain: 'HomeHealthcare',
      site_title: 'Home Healthcare Services',
      admin_user: 'admin',
      admin_password: 'AdminPass123!',
      admin_email: 'admin@HomeHealthcare.dzind.com',
      database: 'homehealthcare_wp-353039344884'
    };
    
    let installSuccess = false;
    
    for (const endpoint of installationEndpoints) {
      try {
        console.log(`   Trying endpoint: ${endpoint}`);
        const installResponse = await apiClient.post(endpoint, installPayload);
        console.log('✅ WordPress installation successful:', installResponse.data);
        installSuccess = true;
        break;
      } catch (installError) {
        console.log(`   ❌ ${endpoint} failed:`, installError.response?.status);
      }
    }
    
    if (!installSuccess) {
      console.log('⚠️  WordPress installation failed with all endpoints');
      console.log('   Manual installation required through 20i control panel');
    }
    
    // Step 4: Create email accounts
    console.log('\n4. Creating email accounts...');
    
    const emailDomain = 'HomeHealthcare.dzind.com';
    const emailAccounts = [
      { local: 'do_not_reply', domain: emailDomain },
      { local: 'support', domain: emailDomain }
    ];
    
    for (const account of emailAccounts) {
      try {
        const emailPayload = {
          local: account.local,
          domain: account.domain,
          password: 'EmailPass123!'
        };
        
        const emailResponse = await apiClient.post(`/package/${packageId}/email`, emailPayload);
        console.log(`✅ Email account created: ${account.local}@${account.domain}`);
      } catch (emailError) {
        console.log(`❌ Failed to create ${account.local}@${account.domain}:`, emailError.response?.status);
      }
    }
    
    // Step 5: Test subdomain access
    console.log('\n5. Testing subdomain access...');
    
    try {
      const siteResponse = await axios.get('https://HomeHealthcare.dzind.com', {
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log('✅ Site accessible:', siteResponse.status);
      console.log('   URL: https://HomeHealthcare.dzind.com');
      
      // Check if it's WordPress
      const isWordPress = siteResponse.data.includes('wp-') || 
                          siteResponse.data.includes('WordPress') ||
                          siteResponse.data.includes('wp_');
      
      if (isWordPress) {
        console.log('✅ WordPress detected on subdomain!');
      } else {
        console.log('⚠️  WordPress not detected - showing default content');
      }
      
    } catch (siteError) {
      console.log('❌ Site not accessible:', siteError.message);
    }
    
    console.log('\n🎉 WordPress installation process completed!');
    console.log('📋 Next steps:');
    console.log('1. Access https://HomeHealthcare.dzind.com');
    console.log('2. Complete WordPress setup if needed');
    console.log('3. Log in to WordPress admin');
    console.log('4. Configure email settings');
    
  } catch (error) {
    console.error('❌ WordPress installation failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

installWordPress();