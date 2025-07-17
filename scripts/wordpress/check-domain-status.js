#!/usr/bin/env node

// Check actual domain configuration and WordPress installation status

import { config } from 'dotenv';
config();

import axios from 'axios';

async function checkDomainStatus() {
  console.log('🔍 Checking actual domain configuration...');
  
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
    // Step 1: Check package web configuration
    console.log('\n1. Checking package web configuration...');
    
    const webResponse = await apiClient.get(`/package/${packageId}/web`);
    console.log('✅ Package configuration:');
    console.log('   Package ID:', webResponse.data.id);
    console.log('   Package Name:', webResponse.data.name);
    console.log('   Domain Names:', webResponse.data.names);
    console.log('   Platform:', webResponse.data.platform);
    console.log('   Setup Complete:', webResponse.data.setupComplete);
    
    // Check if HomeHealthcare.dzind.com is in the names array
    const hasSubdomain = webResponse.data.names.includes('HomeHealthcare.dzind.com');
    console.log('   HomeHealthcare.dzind.com listed:', hasSubdomain ? '✅ YES' : '❌ NO');
    
    // Step 2: Check what's actually installed
    console.log('\n2. Checking installed applications...');
    
    try {
      const oneClickResponse = await apiClient.get(`/package/${packageId}/web/oneclick`);
      console.log('✅ One-click applications available:');
      console.log('   WordPress available:', oneClickResponse.data.wordpress ? 'YES' : 'NO');
      
      if (oneClickResponse.data.wordpress) {
        console.log('   WordPress version:', oneClickResponse.data.wordpress.latest);
        console.log('   WordPress needs DB:', oneClickResponse.data.wordpress.needsDb);
      }
    } catch (oneClickError) {
      console.log('❌ One-click check failed:', oneClickError.response?.status);
    }
    
    // Step 3: Check databases to see what was actually created
    console.log('\n3. Checking databases...');
    
    try {
      const dbResponse = await apiClient.get(`/package/${packageId}/web/mysql`);
      console.log('✅ MySQL databases found:');
      
      const databases = dbResponse.data;
      Object.keys(databases).forEach(dbName => {
        console.log(`   📁 Database: ${dbName}`);
        if (databases[dbName] && databases[dbName].users) {
          console.log(`      Users: ${Object.keys(databases[dbName].users).join(', ')}`);
        }
      });
      
      // Look for WordPress-related databases
      const wpDatabases = Object.keys(databases).filter(name => 
        name.includes('wordpress') || name.includes('wp')
      );
      
      if (wpDatabases.length > 0) {
        console.log('   🔍 WordPress databases found:', wpDatabases);
      } else {
        console.log('   ⚠️ No WordPress databases found');
      }
      
    } catch (dbError) {
      console.log('❌ Database check failed:', dbError.response?.status);
    }
    
    // Step 4: Test domain accessibility
    console.log('\n4. Testing domain accessibility...');
    
    const testDomains = [
      'https://HomeHealthcare.dzind.com',
      'https://dzind.com/HomeHealthcare',
      'https://dzind.com',
      'http://HomeHealthcare.dzind.com'
    ];
    
    for (const domain of testDomains) {
      try {
        console.log(`   Testing ${domain}...`);
        const response = await axios.get(domain, {
          timeout: 10000,
          validateStatus: function (status) {
            return status < 500;
          }
        });
        
        console.log(`   ✅ ${domain} - Status: ${response.status}`);
        
        // Check if it's WordPress
        const isWordPress = response.data.includes('wp-content') || 
                            response.data.includes('wp-includes') ||
                            response.data.includes('WordPress');
        
        if (isWordPress) {
          console.log(`   🎉 WordPress detected at ${domain}`);
        } else {
          console.log(`   📄 Content type: ${response.data.substring(0, 100)}...`);
        }
        
      } catch (testError) {
        console.log(`   ❌ ${domain} - Error: ${testError.message}`);
      }
    }
    
    // Step 5: Check DNS resolution
    console.log('\n5. Checking DNS resolution...');
    
    try {
      const dnsResponse = await axios.get('https://dns.google/resolve?name=HomeHealthcare.dzind.com&type=A');
      console.log('✅ DNS resolution:');
      console.log('   Response:', JSON.stringify(dnsResponse.data, null, 2));
    } catch (dnsError) {
      console.log('❌ DNS check failed:', dnsError.message);
    }
    
    // Step 6: Try to add the subdomain properly
    console.log('\n6. Attempting to add subdomain...');
    
    const subdomainPayloads = [
      { name: 'HomeHealthcare.dzind.com' },
      { domain: 'HomeHealthcare.dzind.com' },
      { subdomain: 'HomeHealthcare', domain: 'dzind.com' }
    ];
    
    for (let i = 0; i < subdomainPayloads.length; i++) {
      const payload = subdomainPayloads[i];
      
      try {
        console.log(`   Trying method ${i + 1}: ${JSON.stringify(payload)}`);
        
        const subdomainResponse = await apiClient.post(`/package/${packageId}/web/serverAlias`, payload);
        console.log('   ✅ Subdomain added successfully!');
        console.log('   Response:', JSON.stringify(subdomainResponse.data, null, 2));
        break;
        
      } catch (subdomainError) {
        console.log(`   ❌ Method ${i + 1} failed:`, subdomainError.response?.status);
        if (subdomainError.response?.data) {
          console.log('   Error:', JSON.stringify(subdomainError.response.data, null, 2));
        }
      }
    }
    
    console.log('\n📋 Domain Status Summary:');
    console.log('- Package ID:', packageId);
    console.log('- Current domains:', webResponse.data.names);
    console.log('- HomeHealthcare.dzind.com configured:', hasSubdomain ? 'YES' : 'NO');
    console.log('- Action needed:', hasSubdomain ? 'None' : 'Add subdomain via StackCP');
    
  } catch (error) {
    console.error('❌ Domain check failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkDomainStatus();