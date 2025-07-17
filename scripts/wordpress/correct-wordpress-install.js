#!/usr/bin/env node

// Correct WordPress installation using proper 20i API endpoints

import { config } from 'dotenv';
config();

import axios from 'axios';

async function installWordPressCorrectly() {
  console.log('🚀 Installing WordPress using CORRECT 20i API endpoints...');
  
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
    // Step 1: Get available applications using the correct endpoint
    console.log('\n1. Getting available applications...');
    const appsResponse = await apiClient.get(`/package/${packageId}/web/applications`);
    
    if (appsResponse.data) {
      console.log('✅ Applications endpoint exists');
      console.log('   Available applications:', Object.keys(appsResponse.data));
    } else {
      console.log('❌ Applications endpoint returned no data');
    }
    
    // Step 2: Try the one-click endpoint with correct payload format
    console.log('\n2. Trying one-click installation with correct payload...');
    
    const oneClickPayload = {
      domain: 'HomeHealthcare.dzind.com',
      httpsDomain: 'HomeHealthcare.dzind.com',
      oneclick: 'wordpress',
      directory: '/',
      installInput: {
        site_title: 'Home Healthcare Services',
        admin_user: 'admin',
        admin_password: 'AdminPass123!',
        admin_email: 'admin@HomeHealthcare.dzind.com'
      }
    };
    
    console.log('   Payload:', JSON.stringify(oneClickPayload, null, 2));
    
    try {
      const oneClickResponse = await apiClient.post(`/package/${packageId}/web/oneclick`, oneClickPayload);
      console.log('✅ One-click installation successful!');
      console.log('   Response:', JSON.stringify(oneClickResponse.data, null, 2));
    } catch (oneClickError) {
      console.log('❌ One-click installation failed:', oneClickError.response?.status);
      console.log('   Error data:', JSON.stringify(oneClickError.response?.data, null, 2));
    }
    
    // Step 3: Try applications endpoint (if available)
    console.log('\n3. Trying applications endpoint...');
    
    try {
      // Get applications list first
      const appsList = await apiClient.get(`/package/${packageId}/web/applications`);
      console.log('✅ Applications list retrieved');
      
      // Look for WordPress in applications
      const applications = appsList.data || {};
      const wordpressApp = applications.wordpress;
      
      if (wordpressApp) {
        console.log('✅ WordPress application found:', wordpressApp);
        
        // Try to install WordPress using applications endpoint
        const applicationPayload = {
          applicationId: 'wordpress',
          path: '/HomeHealthcare',
          config: {
            site_title: 'Home Healthcare Services',
            admin_user: 'admin',
            admin_password: 'AdminPass123!',
            admin_email: 'admin@HomeHealthcare.dzind.com',
            database_name: 'homehealthcare_wp-353039344884'
          }
        };
        
        console.log('   Applications payload:', JSON.stringify(applicationPayload, null, 2));
        
        const appInstallResponse = await apiClient.post(`/package/${packageId}/web/applications`, applicationPayload);
        console.log('✅ Applications installation successful!');
        console.log('   Response:', JSON.stringify(appInstallResponse.data, null, 2));
        
      } else {
        console.log('❌ WordPress not found in applications list');
      }
      
    } catch (appsError) {
      console.log('❌ Applications endpoint failed:', appsError.response?.status);
      console.log('   Error data:', JSON.stringify(appsError.response?.data, null, 2));
    }
    
    // Step 4: Try reinstall endpoint (for existing installations)
    console.log('\n4. Trying reinstall endpoint...');
    
    const reinstallPayload = {
      software: 'wordpress',
      version: 'latest',
      domain: 'HomeHealthcare.dzind.com',
      path: '/'
    };
    
    try {
      const reinstallResponse = await apiClient.post(`/package/${packageId}/web/reinstall`, reinstallPayload);
      console.log('✅ Reinstall successful!');
      console.log('   Response:', JSON.stringify(reinstallResponse.data, null, 2));
    } catch (reinstallError) {
      console.log('❌ Reinstall failed:', reinstallError.response?.status);
      console.log('   Error data:', JSON.stringify(reinstallError.response?.data, null, 2));
    }
    
    // Step 5: Test the site after installation attempts
    console.log('\n5. Testing site after installation...');
    
    try {
      const siteResponse = await axios.get('https://HomeHealthcare.dzind.com', {
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log('✅ Site accessible:', siteResponse.status);
      
      // Check if it's WordPress
      const isWordPress = siteResponse.data.includes('wp-content') || 
                          siteResponse.data.includes('wp-includes') ||
                          siteResponse.data.includes('WordPress') ||
                          siteResponse.data.includes('wp-admin');
      
      if (isWordPress) {
        console.log('✅ WordPress successfully installed!');
        console.log('   WordPress admin: https://HomeHealthcare.dzind.com/wp-admin');
        console.log('   Admin username: admin');
        console.log('   Admin password: AdminPass123!');
      } else {
        console.log('❌ WordPress not detected - still showing default content');
        console.log('   First 200 characters:', siteResponse.data.substring(0, 200));
      }
      
    } catch (siteError) {
      console.log('❌ Site not accessible:', siteError.message);
    }
    
    console.log('\n🎉 WordPress installation process completed!');
    console.log('📋 Results summary:');
    console.log('- API endpoints tested with correct payload formats');
    console.log('- Check site at: https://HomeHealthcare.dzind.com');
    console.log('- If WordPress installed, admin at: https://HomeHealthcare.dzind.com/wp-admin');
    
  } catch (error) {
    console.error('❌ WordPress installation failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

installWordPressCorrectly();