#!/usr/bin/env node

// Create MySQL user with exact MCP server format

import { config } from 'dotenv';
config();

import axios from 'axios';

async function createMySQLUser() {
  console.log('🔍 Creating MySQL user...');
  
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
    // Create MySQL user with minimal payload
    const payload = {
      username: 'hh_wp_user',
      password: 'SecurePass123!'
    };
    
    console.log('Creating user with payload:', payload);
    
    const response = await apiClient.post(`/package/${packageId}/web/mysqlUsers`, payload);
    console.log('✅ MySQL user created successfully:', response.data);
    
    // Now grant access to database
    console.log('\nGranting database access...');
    const grantPayload = {
      username: 'hh_wp_user',
      database: 'homehealthcare_wp-353039344884'
    };
    
    const grantResponse = await apiClient.post(`/package/${packageId}/web/mysqlGrantUserDatabase`, grantPayload);
    console.log('✅ Database access granted:', grantResponse.data);
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Request URL:', error.config?.url);
      console.error('   Request payload:', JSON.stringify(error.config?.data, null, 2));
    }
  }
}

createMySQLUser();