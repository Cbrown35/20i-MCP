#!/usr/bin/env node

// Direct API test for MySQL user creation using axios
import axios from 'axios';

const API_BASE = 'https://api.20i.com';
const API_KEY = process.env.TWENTYI_COMBINED_KEY;

// Validate credentials
if (!API_KEY) {
  console.error('❌ Missing required environment variable: TWENTYI_COMBINED_KEY');
  process.exit(1);
}

async function testDirectAPI() {
  console.log('🔍 Testing Direct API Call for MySQL User Creation');
  
  const client = axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  // Test 1: Check if the package exists and is accessible
  try {
    console.log('\n1. Testing package access...');
    const packageInfo = await client.get('/package/3302301');
    console.log('✅ Package accessible:', packageInfo.data?.name || 'success');
  } catch (e) {
    console.log('❌ Package access failed:', e.response?.status, e.response?.data);
  }

  // Test 2: List MySQL databases to confirm structure
  try {
    console.log('\n2. Listing MySQL databases...');
    const databases = await client.get('/package/3302301/web/mysqlDatabases');
    console.log('✅ Databases found:', databases.data?.length || 0);
    if (databases.data?.[0]) {
      console.log('   First DB:', databases.data[0].name);
    }
  } catch (e) {
    console.log('❌ Database listing failed:', e.response?.status, e.response?.data);
  }

  // Test 3: List existing MySQL users
  try {
    console.log('\n3. Listing existing MySQL users...');
    const users = await client.get('/package/3302301/web/mysqlUsers');
    console.log('✅ Users found:', users.data?.length || 0);
  } catch (e) {
    console.log('❌ User listing failed:', e.response?.status, e.response?.data);
  }

  // Test 4: Attempt MySQL user creation with different payloads
  const testPayloads = [
    {
      name: 'Full database name',
      payload: {
        username: 'shakatogatt_user',
        password: 'Suite2024!DB#Secure',
        database: 'shakatogatt_suite-353039349811'
      }
    },
    {
      name: 'Base database name',
      payload: {
        username: 'shakatogatt_user2',
        password: 'Suite2024!DB#Secure',
        database: 'shakatogatt_suite'
      }
    },
    {
      name: 'Without database parameter',
      payload: {
        username: 'shakatogatt_user3',
        password: 'Suite2024!DB#Secure'
      }
    }
  ];

  for (const test of testPayloads) {
    try {
      console.log(`\n4.${testPayloads.indexOf(test) + 1}. Testing ${test.name}...`);
      const result = await client.post('/package/3302301/web/mysqlUsers', test.payload);
      console.log('✅ Success:', result.data);
      break; // Stop on first success
    } catch (e) {
      console.log(`❌ Failed (${test.name}):`, e.response?.status, e.response?.data);
    }
  }

  console.log('\n🏁 Direct API testing complete');
}

testDirectAPI().catch(console.error);