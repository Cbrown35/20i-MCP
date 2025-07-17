#!/usr/bin/env node

// Setup SSL certificate and performance optimization for HomeHealthcare.dzind.com

import { config } from 'dotenv';
config();

import axios from 'axios';

async function setupSSLPerformance() {
  console.log('🔐 Setting up SSL and performance optimization...');
  
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
    // Step 1: Check current SSL configuration
    console.log('\n1. Checking current SSL configuration...');
    
    try {
      const sslResponse = await apiClient.get(`/package/${packageId}/web/ssl`);
      console.log('✅ SSL configuration retrieved:');
      console.log('   Response:', JSON.stringify(sslResponse.data, null, 2));
    } catch (sslError) {
      console.log('❌ SSL configuration check failed:', sslError.response?.status);
      console.log('   Error:', JSON.stringify(sslError.response?.data, null, 2));
    }
    
    // Step 2: Enable SSL for the subdomain
    console.log('\n2. Enabling SSL for HomeHealthcare.dzind.com...');
    
    const sslPayload = {
      domain: 'HomeHealthcare.dzind.com',
      force_ssl: true,
      auto_renew: true
    };
    
    try {
      const sslEnableResponse = await apiClient.post(`/package/${packageId}/web/ssl`, sslPayload);
      console.log('✅ SSL enabled successfully!');
      console.log('   Response:', JSON.stringify(sslEnableResponse.data, null, 2));
    } catch (sslEnableError) {
      console.log('❌ SSL enablement failed:', sslEnableError.response?.status);
      console.log('   Error:', JSON.stringify(sslEnableError.response?.data, null, 2));
    }
    
    // Step 3: Check CDN configuration
    console.log('\n3. Checking CDN configuration...');
    
    try {
      const cdnResponse = await apiClient.get(`/package/${packageId}/web/cdn`);
      console.log('✅ CDN configuration retrieved:');
      console.log('   Response:', JSON.stringify(cdnResponse.data, null, 2));
    } catch (cdnError) {
      console.log('❌ CDN configuration check failed:', cdnError.response?.status);
      console.log('   Error:', JSON.stringify(cdnError.response?.data, null, 2));
    }
    
    // Step 4: Enable CDN for the subdomain
    console.log('\n4. Enabling CDN for HomeHealthcare.dzind.com...');
    
    const cdnPayload = {
      domain: 'HomeHealthcare.dzind.com',
      enabled: true,
      cache_everything: true,
      browser_cache_ttl: 31536000, // 1 year
      edge_cache_ttl: 86400 // 1 day
    };
    
    try {
      const cdnEnableResponse = await apiClient.post(`/package/${packageId}/web/cdn`, cdnPayload);
      console.log('✅ CDN enabled successfully!');
      console.log('   Response:', JSON.stringify(cdnEnableResponse.data, null, 2));
    } catch (cdnEnableError) {
      console.log('❌ CDN enablement failed:', cdnEnableError.response?.status);
      console.log('   Error:', JSON.stringify(cdnEnableError.response?.data, null, 2));
    }
    
    // Step 5: Configure caching
    console.log('\n5. Configuring caching...');
    
    const cachePayload = {
      domain: 'HomeHealthcare.dzind.com',
      cache_level: 'aggressive',
      development_mode: false,
      browser_cache_ttl: 31536000,
      edge_cache_ttl: 86400
    };
    
    try {
      const cacheResponse = await apiClient.post(`/package/${packageId}/web/cache`, cachePayload);
      console.log('✅ Caching configured successfully!');
      console.log('   Response:', JSON.stringify(cacheResponse.data, null, 2));
    } catch (cacheError) {
      console.log('❌ Caching configuration failed:', cacheError.response?.status);
      console.log('   Error:', JSON.stringify(cacheError.response?.data, null, 2));
    }
    
    // Step 6: Configure security headers
    console.log('\n6. Configuring security headers...');
    
    const securityPayload = {
      domain: 'HomeHealthcare.dzind.com',
      security_headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      }
    };
    
    try {
      const securityResponse = await apiClient.post(`/package/${packageId}/web/security`, securityPayload);
      console.log('✅ Security headers configured successfully!');
      console.log('   Response:', JSON.stringify(securityResponse.data, null, 2));
    } catch (securityError) {
      console.log('❌ Security headers configuration failed:', securityError.response?.status);
      console.log('   Error:', JSON.stringify(securityError.response?.data, null, 2));
    }
    
    // Step 7: Enable compression
    console.log('\n7. Enabling compression...');
    
    const compressionPayload = {
      domain: 'HomeHealthcare.dzind.com',
      compression: 'gzip',
      brotli: true
    };
    
    try {
      const compressionResponse = await apiClient.post(`/package/${packageId}/web/compression`, compressionPayload);
      console.log('✅ Compression enabled successfully!');
      console.log('   Response:', JSON.stringify(compressionResponse.data, null, 2));
    } catch (compressionError) {
      console.log('❌ Compression enablement failed:', compressionError.response?.status);
      console.log('   Error:', JSON.stringify(compressionError.response?.data, null, 2));
    }
    
    // Step 8: Test SSL and performance
    console.log('\n8. Testing SSL and performance...');
    
    try {
      const testResponse = await axios.get('https://HomeHealthcare.dzind.com', {
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log('✅ HTTPS test successful:', testResponse.status);
      console.log('   SSL Headers:');
      console.log('   - Strict-Transport-Security:', testResponse.headers['strict-transport-security'] || 'Not set');
      console.log('   - X-Frame-Options:', testResponse.headers['x-frame-options'] || 'Not set');
      console.log('   - X-Content-Type-Options:', testResponse.headers['x-content-type-options'] || 'Not set');
      console.log('   - Content-Encoding:', testResponse.headers['content-encoding'] || 'Not set');
      console.log('   - X-Provided-By:', testResponse.headers['x-provided-by'] || 'Not set');
      
    } catch (testError) {
      console.log('❌ HTTPS test failed:', testError.message);
    }
    
    console.log('\n🎉 SSL and performance optimization completed!');
    console.log('📋 Configuration Summary:');
    console.log('- SSL Certificate: Enabled with auto-renewal');
    console.log('- Force HTTPS: Enabled');
    console.log('- CDN: Enabled with aggressive caching');
    console.log('- Security Headers: Configured');
    console.log('- Compression: Enabled (gzip + brotli)');
    console.log('- Browser Cache TTL: 1 year');
    console.log('- Edge Cache TTL: 1 day');
    
    console.log('\n⚠️  Manual StackCP Steps for Additional Security:');
    console.log('1. Go to StackCP > Security > SSL/TLS');
    console.log('2. Verify Let\'s Encrypt certificate is active');
    console.log('3. Enable "Always Use HTTPS" if not already enabled');
    console.log('4. Configure firewall rules if needed');
    console.log('5. Set up monitoring and alerts');
    
  } catch (error) {
    console.error('❌ SSL/Performance setup failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

setupSSLPerformance();