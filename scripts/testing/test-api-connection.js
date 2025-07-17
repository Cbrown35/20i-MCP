#!/usr/bin/env node

// Test script to verify 20i API connection and domain access
// This script will test the API keys and look for dzind.com domain

import { config } from 'dotenv';
config();

import axios from 'axios';

class TwentyITester {
  constructor() {
    this.apiKey = process.env.TWENTYI_API_KEY;
    this.oauthKey = process.env.TWENTYI_OAUTH_KEY;
    this.combinedKey = process.env.TWENTYI_COMBINED_KEY;
    
    if (!this.apiKey || !this.oauthKey || !this.combinedKey) {
      throw new Error('Missing API keys in environment variables');
    }
    
    const authHeader = `Bearer ${Buffer.from(this.apiKey).toString('base64')}`;
    
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection() {
    console.log('🔍 Testing 20i API connection...');
    
    try {
      // Test 1: Get reseller info
      console.log('\n1. Testing reseller account access...');
      const resellerResponse = await this.apiClient.get('/reseller');
      console.log('✅ Reseller info retrieved successfully');
      console.log('   Reseller ID:', resellerResponse.data?.id || 'Not found');
      
      // Test 2: Get account balance
      console.log('\n2. Testing account balance...');
      const resellerId = resellerResponse.data?.id;
      if (resellerId) {
        try {
          const balanceResponse = await this.apiClient.get(`/reseller/${resellerId}/accountBalance`);
          console.log('✅ Account balance retrieved successfully');
          console.log('   Balance:', balanceResponse.data?.balance || 'Not available');
        } catch (balanceError) {
          console.log('⚠️  Account balance not available (may be normal for new accounts)');
        }
      }
      
      // Test 3: List domains
      console.log('\n3. Testing domain listing...');
      const domainsResponse = await this.apiClient.get('/domain');
      console.log('✅ Domain list retrieved successfully');
      console.log('   Total domains:', Array.isArray(domainsResponse.data) ? domainsResponse.data.length : 'Unknown');
      
      // Test 4: Check for dzind.com domain
      console.log('\n4. Checking for dzind.com domain...');
      const domains = Array.isArray(domainsResponse.data) ? domainsResponse.data : [];
      const dzindDomain = domains.find(domain => domain.name === 'dzind.com');
      
      if (dzindDomain) {
        console.log('✅ dzind.com domain found!');
        console.log('   Domain ID:', dzindDomain.id);
        console.log('   Status:', dzindDomain.status || 'Unknown');
        
        // Test 5: Get domain details
        console.log('\n5. Getting dzind.com domain details...');
        try {
          const domainDetailsResponse = await this.apiClient.get(`/domain/${dzindDomain.id}`);
          console.log('✅ Domain details retrieved successfully');
          console.log('   Registrar:', domainDetailsResponse.data?.registrar || 'Not available');
          console.log('   Expires:', domainDetailsResponse.data?.expires || 'Not available');
        } catch (detailsError) {
          console.log('⚠️  Domain details not available');
        }
        
        // Test 6: Check for hosting packages
        console.log('\n6. Checking for hosting packages...');
        try {
          const packagesResponse = await this.apiClient.get('/package');
          console.log('✅ Hosting packages retrieved successfully');
          console.log('   Total packages:', Array.isArray(packagesResponse.data) ? packagesResponse.data.length : 'Unknown');
          
          // Look for packages that might be associated with dzind.com
          const packages = Array.isArray(packagesResponse.data) ? packagesResponse.data : [];
          const relevantPackages = packages.filter(pkg => 
            pkg.name?.includes('dzind') || 
            pkg.domain_name?.includes('dzind.com')
          );
          
          if (relevantPackages.length > 0) {
            console.log('✅ Found hosting packages for dzind.com:');
            relevantPackages.forEach(pkg => {
              console.log(`   - Package: ${pkg.name} (ID: ${pkg.id})`);
              console.log(`     Domain: ${pkg.domain_name}`);
            });
          } else {
            console.log('⚠️  No hosting packages found specifically for dzind.com');
            console.log('   Available packages:');
            packages.slice(0, 3).forEach(pkg => {
              console.log(`   - ${pkg.name} (${pkg.domain_name})`);
            });
          }
        } catch (packagesError) {
          console.log('⚠️  Could not retrieve hosting packages');
        }
        
      } else {
        console.log('❌ dzind.com domain not found in your account');
        console.log('   Available domains:');
        domains.slice(0, 5).forEach(domain => {
          console.log(`   - ${domain.name}`);
        });
      }
      
      console.log('\n🎉 API connection test completed successfully!');
      console.log('✅ Ready to proceed with WordPress deployment');
      
    } catch (error) {
      console.error('❌ API connection test failed:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
      throw error;
    }
  }
}

// Run the test
async function runTest() {
  try {
    const tester = new TwentyITester();
    await tester.testConnection();
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTest();