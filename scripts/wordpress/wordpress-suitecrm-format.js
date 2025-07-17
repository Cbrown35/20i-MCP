#!/usr/bin/env node

// WordPress installation using exact SuiteCRM format

import { config } from 'dotenv';
config();

import axios from 'axios';

async function installWordPressSuiteCRMFormat() {
  console.log('🚀 Installing WordPress using SuiteCRM format...');
  
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
    // Step 1: Verify WordPress is available
    console.log('\n1. Verifying WordPress availability...');
    const oneClickResponse = await apiClient.get(`/package/${packageId}/web/oneclick`);
    
    const wordpressApp = oneClickResponse.data.wordpress;
    if (!wordpressApp) {
      throw new Error('WordPress not available in one-click applications');
    }
    
    console.log('✅ WordPress found:', wordpressApp.displayName, 'v' + wordpressApp.latest);
    console.log('   Needs database:', wordpressApp.needsDb);
    
    // Step 2: Install WordPress using EXACT SuiteCRM format
    console.log('\n2. Installing WordPress with SuiteCRM format...');
    
    const wordpressPayload = {
      domain: 'HomeHealthcare.dzind.com',
      httpsDomain: 'HomeHealthcare.dzind.com',
      oneclick: 'wordpress',
      directory: '/wordpress',
      installInput: {
        database_name: 'homehealthcare_wp-353039344884',
        database_user: 'hh_wp_user',
        database_password: 'WP2024!DB#Secure',
        admin_username: 'admin',
        admin_password: 'Admin2024!WP#',
        admin_email: 'admin@HomeHealthcare.dzind.com',
        site_title: 'Home Healthcare Services',
        site_tagline: 'Professional Healthcare Solutions'
      }
    };
    
    console.log('   Payload:', JSON.stringify(wordpressPayload, null, 2));
    
    try {
      const installResponse = await apiClient.post(`/package/${packageId}/web/oneclick`, wordpressPayload);
      console.log('✅ WordPress installation successful!');
      console.log('   Response:', JSON.stringify(installResponse.data, null, 2));
      
      // Step 3: Wait for installation to complete
      console.log('\n3. Waiting for installation to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      // Step 4: Test WordPress installation
      console.log('\n4. Testing WordPress installation...');
      
      const testUrls = [
        'https://HomeHealthcare.dzind.com/wordpress',
        'https://HomeHealthcare.dzind.com/wordpress/wp-admin',
        'https://HomeHealthcare.dzind.com'
      ];
      
      for (const url of testUrls) {
        try {
          const testResponse = await axios.get(url, {
            timeout: 10000,
            validateStatus: function (status) {
              return status < 500;
            }
          });
          
          console.log(`✅ ${url} - Status: ${testResponse.status}`);
          
          const isWordPress = testResponse.data.includes('wp-content') || 
                              testResponse.data.includes('wp-includes') ||
                              testResponse.data.includes('WordPress') ||
                              testResponse.data.includes('wp-admin') ||
                              testResponse.data.includes('wp-json');
          
          if (isWordPress) {
            console.log('   🎉 WordPress detected!');
            console.log('   Admin URL: https://HomeHealthcare.dzind.com/wordpress/wp-admin');
            console.log('   Username: admin');
            console.log('   Password: Admin2024!WP#');
            break;
          }
        } catch (testError) {
          console.log(`❌ ${url} - Error: ${testError.message}`);
        }
      }
      
    } catch (installError) {
      console.log('❌ WordPress installation failed:', installError.response?.status);
      console.log('   Error:', JSON.stringify(installError.response?.data, null, 2));
      
      // Try alternative format without httpsDomain
      console.log('\n   Trying alternative format without httpsDomain...');
      
      const alternativePayload = {
        domain: 'HomeHealthcare.dzind.com',
        oneclick: 'wordpress',
        directory: '/wordpress',
        installInput: {
          database_name: 'homehealthcare_wp-353039344884',
          admin_username: 'admin',
          admin_password: 'Admin2024!WP#',
          admin_email: 'admin@HomeHealthcare.dzind.com',
          site_title: 'Home Healthcare Services'
        }
      };
      
      try {
        const altResponse = await apiClient.post(`/package/${packageId}/web/oneclick`, alternativePayload);
        console.log('✅ Alternative format successful!');
        console.log('   Response:', JSON.stringify(altResponse.data, null, 2));
      } catch (altError) {
        console.log('❌ Alternative format also failed:', altError.response?.status);
        console.log('   Error:', JSON.stringify(altError.response?.data, null, 2));
      }
    }
    
    console.log('\n🎉 WordPress installation process completed!');
    console.log('📋 Next steps:');
    console.log('1. Check https://HomeHealthcare.dzind.com/wordpress');
    console.log('2. Access admin at https://HomeHealthcare.dzind.com/wordpress/wp-admin');
    console.log('3. Login with: admin / Admin2024!WP#');
    
  } catch (error) {
    console.error('❌ WordPress installation failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

installWordPressSuiteCRMFormat();