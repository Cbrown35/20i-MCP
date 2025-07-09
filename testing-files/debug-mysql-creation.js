import axios from 'axios';

// Check for required environment variables
if (!process.env.TWENTYI_COMBINED_KEY && (!process.env.TWENTYI_API_KEY || !process.env.TWENTYI_OAUTH_KEY)) {
  console.error('❌ Error: Either TWENTYI_COMBINED_KEY or both TWENTYI_API_KEY and TWENTYI_OAUTH_KEY environment variables are required');
  console.error('Please set them using:');
  console.error('  export TWENTYI_COMBINED_KEY="your_api_key+your_oauth_key"');
  console.error('OR');
  console.error('  export TWENTYI_API_KEY="your_api_key"');
  console.error('  export TWENTYI_OAUTH_KEY="your_oauth_key"');
  process.exit(1);
}

const API_BASE = 'https://api.20i.com';
const API_KEY = process.env.TWENTYI_COMBINED_KEY || `${process.env.TWENTYI_API_KEY}+${process.env.TWENTYI_OAUTH_KEY}`;

console.log('🔍 Direct API Debugging for MySQL User Creation\n');

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Test the exact endpoint that's failing
async function testMysqlUserCreation() {
  const testCases = [
    {
      name: 'Standard creation with database',
      url: '/package/3302301/web/mysqlUsers',
      method: 'POST',
      data: {
        username: 'test_api_user1',
        password: 'TestAPI123!',
        database: 'shakatogatt_suite-353039349811'
      }
    },
    {
      name: 'Creation without database',
      url: '/package/3302301/web/mysqlUsers', 
      method: 'POST',
      data: {
        username: 'test_api_user2',
        password: 'TestAPI123!'
      }
    },
    {
      name: 'GET existing users for reference',
      url: '/package/3302301/web/mysqlUsers',
      method: 'GET',
      data: null
    }
  ];

  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    console.log(`URL: ${API_BASE}${test.url}`);
    console.log(`Method: ${test.method}`);
    console.log(`Data:`, test.data);
    
    try {
      let result;
      if (test.method === 'GET') {
        result = await client.get(test.url);
      } else {
        result = await client.post(test.url, test.data);
      }
      
      console.log('✅ SUCCESS:', result.status);
      console.log('Response:', JSON.stringify(result.data, null, 2));
    } catch (error) {
      console.log('❌ FAILED:', error.response?.status || 'Network Error');
      console.log('Error:', error.response?.data || error.message);
    }
    console.log('---\n');
  }
}

await testMysqlUserCreation();