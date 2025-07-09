import axios from 'axios';

const API_BASE = 'https://api.20i.com';
const API_KEY = process.env.TWENTYI_COMBINED_KEY;

// Validate credentials
if (!API_KEY) {
  console.error('❌ Missing required environment variable: TWENTYI_COMBINED_KEY');
  process.exit(1);
}

// Use the same authentication method as our MCP server
const authHeader = `Bearer ${Buffer.from(API_KEY).toString('base64')}`;

console.log('🔍 Testing with Base64 Authentication\n');
console.log('Original API Key:', API_KEY);
console.log('Base64 Auth Header:', authHeader);
console.log('');

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000
});

// Test MySQL user creation with correct authentication
async function testWithCorrectAuth() {
  console.log('Testing MySQL user creation with base64 auth...\n');
  
  // First test: GET users (should work)
  try {
    console.log('1. GET /package/3302301/web/mysqlUsers');
    const getUsersResult = await client.get('/package/3302301/web/mysqlUsers');
    console.log('✅ GET Users SUCCESS:', getUsersResult.status);
    console.log('Current users:', getUsersResult.data?.length || 0);
  } catch (error) {
    console.log('❌ GET Users FAILED:', error.response?.status, error.response?.data);
  }
  
  // Second test: POST create user 
  try {
    console.log('\n2. POST /package/3302301/web/mysqlUsers (create user)');
    const createResult = await client.post('/package/3302301/web/mysqlUsers', {
      username: 'api_test_user',
      password: 'APITest123!',
      database: 'shakatogatt_suite-353039349811'
    });
    console.log('✅ CREATE User SUCCESS:', createResult.status);
    console.log('Result:', createResult.data);
  } catch (error) {
    console.log('❌ CREATE User FAILED:', error.response?.status, error.response?.data);
  }
  
  // Third test: POST create user without database
  try {
    console.log('\n3. POST /package/3302301/web/mysqlUsers (without database)');
    const createResult = await client.post('/package/3302301/web/mysqlUsers', {
      username: 'api_test_user2',
      password: 'APITest123!'
    });
    console.log('✅ CREATE User (no DB) SUCCESS:', createResult.status);
    console.log('Result:', createResult.data);
  } catch (error) {
    console.log('❌ CREATE User (no DB) FAILED:', error.response?.status, error.response?.data);
  }
}

await testWithCorrectAuth();