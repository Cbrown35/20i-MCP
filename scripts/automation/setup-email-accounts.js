#!/usr/bin/env node

// Setup email accounts for HomeHealthcare.dzind.com

import { config } from 'dotenv';
config();

import axios from 'axios';

async function setupEmailAccounts() {
  console.log('📧 Setting up email accounts for HomeHealthcare.dzind.com...');
  
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
    // Step 1: Check existing email configuration
    console.log('\n1. Checking existing email configuration...');
    
    try {
      const emailResponse = await apiClient.get(`/package/${packageId}/email`);
      console.log('✅ Email configuration retrieved:');
      console.log('   Response:', JSON.stringify(emailResponse.data, null, 2));
    } catch (emailError) {
      console.log('❌ Email configuration check failed:', emailError.response?.status);
      console.log('   Error:', JSON.stringify(emailError.response?.data, null, 2));
    }
    
    // Step 2: Try to add email forwarders
    console.log('\n2. Setting up email forwarders...');
    
    const emailForwarders = [
      {
        name: 'do_not_reply',
        domain: 'HomeHealthcare.dzind.com',
        destination: 'admin@HomeHealthcare.dzind.com'
      },
      {
        name: 'support',
        domain: 'HomeHealthcare.dzind.com',
        destination: 'admin@HomeHealthcare.dzind.com'
      }
    ];
    
    for (const forwarder of emailForwarders) {
      try {
        const forwarderPayload = {
          name: forwarder.name,
          domain: forwarder.domain,
          destination: forwarder.destination
        };
        
        console.log(`   Adding forwarder: ${forwarder.name}@${forwarder.domain}`);
        console.log('   Payload:', JSON.stringify(forwarderPayload, null, 2));
        
        const forwarderResponse = await apiClient.post(`/package/${packageId}/email/forwarder`, forwarderPayload);
        console.log('✅ Forwarder added successfully!');
        console.log('   Response:', JSON.stringify(forwarderResponse.data, null, 2));
        
      } catch (forwarderError) {
        console.log(`❌ Forwarder addition failed: ${forwarderError.response?.status}`);
        console.log('   Error:', JSON.stringify(forwarderError.response?.data, null, 2));
      }
    }
    
    // Step 3: Try to create email accounts
    console.log('\n3. Setting up email accounts...');
    
    const emailAccounts = [
      {
        name: 'admin',
        domain: 'HomeHealthcare.dzind.com',
        password: 'AdminEmail2024!',
        quota: 1000 // 1GB in MB
      },
      {
        name: 'support',
        domain: 'HomeHealthcare.dzind.com',
        password: 'Support2024!',
        quota: 500 // 500MB in MB
      }
    ];
    
    for (const account of emailAccounts) {
      try {
        const accountPayload = {
          name: account.name,
          domain: account.domain,
          password: account.password,
          quota: account.quota
        };
        
        console.log(`   Creating email account: ${account.name}@${account.domain}`);
        console.log('   Payload (password hidden):', {
          name: account.name,
          domain: account.domain,
          quota: account.quota
        });
        
        const accountResponse = await apiClient.post(`/package/${packageId}/email/account`, accountPayload);
        console.log('✅ Email account created successfully!');
        console.log('   Response:', JSON.stringify(accountResponse.data, null, 2));
        
      } catch (accountError) {
        console.log(`❌ Email account creation failed: ${accountError.response?.status}`);
        console.log('   Error:', JSON.stringify(accountError.response?.data, null, 2));
      }
    }
    
    // Step 4: Check email routing/MX records
    console.log('\n4. Checking email routing configuration...');
    
    try {
      const routingResponse = await apiClient.get(`/package/${packageId}/email/routing`);
      console.log('✅ Email routing configuration:');
      console.log('   Response:', JSON.stringify(routingResponse.data, null, 2));
    } catch (routingError) {
      console.log('❌ Email routing check failed:', routingError.response?.status);
      console.log('   Error:', JSON.stringify(routingError.response?.data, null, 2));
    }
    
    // Step 5: Set up email routing for subdomain
    console.log('\n5. Setting up email routing for subdomain...');
    
    const routingPayload = {
      domain: 'HomeHealthcare.dzind.com',
      type: 'local',
      mx_priority: 10
    };
    
    try {
      const routingSetupResponse = await apiClient.post(`/package/${packageId}/email/routing`, routingPayload);
      console.log('✅ Email routing setup successful!');
      console.log('   Response:', JSON.stringify(routingSetupResponse.data, null, 2));
    } catch (routingSetupError) {
      console.log('❌ Email routing setup failed:', routingSetupError.response?.status);
      console.log('   Error:', JSON.stringify(routingSetupError.response?.data, null, 2));
    }
    
    console.log('\n🎉 Email setup completed!');
    console.log('📋 Email Configuration Summary:');
    console.log('- Domain: HomeHealthcare.dzind.com');
    console.log('- Accounts: admin@HomeHealthcare.dzind.com, support@HomeHealthcare.dzind.com');
    console.log('- Forwarders: do_not_reply@HomeHealthcare.dzind.com → admin@HomeHealthcare.dzind.com');
    console.log('- Note: Final configuration may need to be completed via StackCP control panel');
    
    console.log('\n📧 Manual StackCP Steps Required:');
    console.log('1. Access StackCP control panel');
    console.log('2. Go to Email > Email Accounts');
    console.log('3. Verify subdomain email routing is enabled');
    console.log('4. Create email accounts if API creation failed');
    console.log('5. Set up email forwarders and aliases');
    console.log('6. Configure SPF, DKIM, and DMARC records for security');
    
  } catch (error) {
    console.error('❌ Email setup failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

setupEmailAccounts();