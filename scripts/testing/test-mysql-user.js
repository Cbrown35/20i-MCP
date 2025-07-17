#!/usr/bin/env node

// Test MySQL user creation with exact MCP server approach

import { config } from 'dotenv';
config();

import axios from 'axios';

async function testMySQLUserCreation() {
  console.log('🔍 Testing MySQL user creation...');
  
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
    // Test 1: Check existing MySQL users
    console.log('\n1. Getting existing MySQL users...');
    const existingUsersResponse = await apiClient.get(`/package/${packageId}/web/mysqlUsers`);
    console.log('✅ Existing users retrieved:', existingUsersResponse.data);
    
    // Test 2: Try to create a new MySQL user
    console.log('\n2. Creating new MySQL user...');
    const newUserPayload = {
      username: 'test_user_' + Date.now(),
      password: 'TestPassword123!',
      database: 'homehealthcare_wp-353039344884'
    };
    
    console.log('   Payload:', newUserPayload);
    
    const createUserResponse = await apiClient.post(`/package/${packageId}/web/mysqlUsers`, newUserPayload);
    console.log('✅ User created successfully:', createUserResponse.data);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Headers:', error.response.headers);
    }
    console.error('   Request URL:', error.config?.url);
    console.error('   Request method:', error.config?.method);
  }
}

testMySQLUserCreation();