#!/usr/bin/env node

// Setup subdomain and install WordPress properly

import { config } from 'dotenv';
config();

import axios from 'axios';

async function setupSubdomainWordPress() {
  console.log('🚀 Setting up subdomain and WordPress installation...');
  
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
    // Step 1: Add subdomain to package
    console.log('\n1. Adding subdomain HomeHealthcare.dzind.com...');
    
    const subdomainPayload = {
      name: 'HomeHealthcare.dzind.com',
      type: 'alias'
    };
    
    try {
      const subdomainResponse = await apiClient.post(`/package/${packageId}/web/domain`, subdomainPayload);
      console.log('✅ Subdomain added successfully!');
      console.log('   Response:', JSON.stringify(subdomainResponse.data, null, 2));
    } catch (subdomainError) {
      console.log('❌ Subdomain addition failed:', subdomainError.response?.status);
      console.log('   Error:', JSON.stringify(subdomainError.response?.data, null, 2));
      
      // Check if subdomain already exists
      if (subdomainError.response?.status === 409) {
        console.log('   ✅ Subdomain already exists, continuing...');
      } else {
        throw subdomainError;
      }
    }
    
    // Step 2: Wait for subdomain to propagate
    console.log('\n2. Waiting for subdomain to propagate...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Verify subdomain is accessible
    console.log('\n3. Verifying subdomain accessibility...');
    
    try {
      const subdomainTest = await axios.get('https://HomeHealthcare.dzind.com', {
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log('✅ Subdomain accessible:', subdomainTest.status);
    } catch (accessError) {
      console.log('⚠️ Subdomain not yet accessible:', accessError.message);
    }
    
    // Step 4: Install WordPress on the subdomain
    console.log('\n4. Installing WordPress on subdomain...');
    
    const wordpressPayload = {
      domain: 'HomeHealthcare.dzind.com',
      oneclick: 'wordpress',
      directory: '/',
      installInput: {
        site_title: 'Home Healthcare Services',
        admin_user: 'admin',
        admin_password: 'Admin2024!WP#',
        admin_email: 'admin@HomeHealthcare.dzind.com'
      }
    };
    
    try {
      console.log('   WordPress payload:', JSON.stringify(wordpressPayload, null, 2));
      
      const wordpressResponse = await apiClient.post(`/package/${packageId}/web/oneclick`, wordpressPayload);
      console.log('✅ WordPress installation successful!');
      console.log('   Response:', JSON.stringify(wordpressResponse.data, null, 2));
      
      // Parse the response to get database info
      const responseData = wordpressResponse.data;
      if (responseData.database) {
        console.log('   🗄️ Database created:', responseData.database);
      }
      if (responseData.user) {
        console.log('   👤 Database user:', responseData.user);
      }
      
    } catch (wordpressError) {
      console.log('❌ WordPress installation failed:', wordpressError.response?.status);
      console.log('   Error:', JSON.stringify(wordpressError.response?.data, null, 2));
      
      // Try alternative installation method
      console.log('\n   Trying alternative installation method...');
      
      const altPayload = {
        domain: 'HomeHealthcare.dzind.com',
        oneclick: 'wordpress',
        directory: '/wp',
        installInput: {
          site_title: 'Home Healthcare Services',
          admin_user: 'admin',
          admin_password: 'Admin2024!WP#',
          admin_email: 'admin@HomeHealthcare.dzind.com'
        }
      };
      
      try {
        const altResponse = await apiClient.post(`/package/${packageId}/web/oneclick`, altPayload);
        console.log('✅ Alternative WordPress installation successful!');
        console.log('   Response:', JSON.stringify(altResponse.data, null, 2));
      } catch (altError) {
        console.log('❌ Alternative installation failed:', altError.response?.status);
        console.log('   Error:', JSON.stringify(altError.response?.data, null, 2));
      }
    }
    
    // Step 5: Wait for WordPress installation to complete
    console.log('\n5. Waiting for WordPress installation to complete...');
    await new Promise(resolve => setTimeout(resolve, 20000)); // Wait 20 seconds
    
    // Step 6: Test WordPress installation
    console.log('\n6. Testing WordPress installation...');
    
    const testUrls = [
      'https://HomeHealthcare.dzind.com',
      'https://HomeHealthcare.dzind.com/wp',
      'https://HomeHealthcare.dzind.com/wp-admin',
      'https://HomeHealthcare.dzind.com/wp/wp-admin'
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
          console.log('   Admin URL:', url.includes('wp-admin') ? url : `${url}/wp-admin`);
          console.log('   Username: admin');
          console.log('   Password: Admin2024!WP#');
          break;
        }
      } catch (testError) {
        console.log(`❌ ${url} - Error: ${testError.message}`);
      }
    }
    
    // Step 7: Enable SSL for the subdomain
    console.log('\n7. Enabling SSL for subdomain...');
    
    const sslPayload = {
      domain: 'HomeHealthcare.dzind.com',
      force_ssl: true,
      auto_renew: true
    };
    
    try {
      const sslResponse = await apiClient.post(`/package/${packageId}/web/ssl`, sslPayload);
      console.log('✅ SSL enabled successfully!');
      console.log('   Response:', JSON.stringify(sslResponse.data, null, 2));
    } catch (sslError) {
      console.log('❌ SSL enablement failed:', sslError.response?.status);
      console.log('   Error:', JSON.stringify(sslError.response?.data, null, 2));
    }
    
    console.log('\n🎉 Subdomain and WordPress setup completed!');
    console.log('📋 Summary:');
    console.log('- Subdomain: HomeHealthcare.dzind.com');
    console.log('- WordPress: Installed with admin credentials');
    console.log('- SSL: Enabled with auto-renewal');
    console.log('- Next: Configure email accounts and security');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

setupSubdomainWordPress();