import axios from 'axios';

// Check for required environment variables
if (!process.env.TWENTYI_API_KEY) {
  console.error('❌ Error: TWENTYI_API_KEY environment variable is required');
  console.error('Please set it using: export TWENTYI_API_KEY="your_api_key_here"');
  process.exit(1);
}

const API_KEY = process.env.TWENTYI_API_KEY;
const authHeader = `Bearer ${Buffer.from(API_KEY).toString('base64')}`;
const PACKAGE_ID = '3302301';

console.log('🔍 Testing Alternative Request Formats for MySQL User Creation\n');

const baseConfig = {
  baseURL: 'https://api.20i.com',
  headers: {
    'Authorization': authHeader,
  },
  timeout: 10000
};

// Test different request formats
async function testDifferentFormats() {
  const testCases = [
    {
      name: 'JSON Content-Type',
      headers: { ...baseConfig.headers, 'Content-Type': 'application/json' },
      data: {
        username: 'format_test_1',
        password: 'FormatTest123!',
        database: 'shakatogatt_suite-353039349811'
      }
    },
    {
      name: 'Form URL Encoded',
      headers: { ...baseConfig.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'username=format_test_2&password=FormatTest123!&database=shakatogatt_suite-353039349811'
    },
    {
      name: 'Multipart Form Data',
      headers: { ...baseConfig.headers, 'Content-Type': 'multipart/form-data' },
      data: {
        username: 'format_test_3',
        password: 'FormatTest123!',
        database: 'shakatogatt_suite-353039349811'
      }
    },
    {
      name: 'No Content-Type',
      headers: { ...baseConfig.headers },
      data: {
        username: 'format_test_4',
        password: 'FormatTest123!',
        database: 'shakatogatt_suite-353039349811'
      }
    },
    {
      name: 'Different Database Format',
      headers: { ...baseConfig.headers, 'Content-Type': 'application/json' },
      data: {
        username: 'format_test_5',
        password: 'FormatTest123!',
        database: 'shakatogatt_suite' // Without the suffix
      }
    },
    {
      name: 'Fields Method Simulation',
      headers: { ...baseConfig.headers, 'Content-Type': 'application/json', 'X-Method': 'postWithFields' },
      data: {
        username: 'format_test_6',
        password: 'FormatTest123!',
        database: 'shakatogatt_suite-353039349811'
      }
    }
  ];

  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const client = axios.create({
        ...baseConfig,
        headers: test.headers
      });
      
      const result = await client.post(`/package/${PACKAGE_ID}/web/mysqlUsers`, test.data);
      console.log(`  ✅ SUCCESS (${result.status}):`, result.data);
      console.log('  🎉 Found working format!');
      break; // Stop on first success
      
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

// Test alternative endpoint patterns
async function testAlternativeEndpoints() {
  console.log('\\n🔗 Testing Alternative Endpoint Patterns\\n');
  
  const endpoints = [
    '/package/{packageId}/web/mysqlUsers',           // Standard (what we've been using)
    '/package/{packageId}/web/mysqlUser',            // Singular
    '/package/{packageId}/web/createMysqlUser',      // Different verb
    '/package/{packageId}/web/mysql/users',          // Different path structure
    '/package/{packageId}/web/mysql/createUser',     // Different path + verb
    '/package/{packageId}/mysqlUsers',               // Without /web
    '/services/package/{packageId}/web/mysqlUsers',  // With services prefix
  ];

  const client = axios.create({
    baseURL: 'https://api.20i.com',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    timeout: 5000
  });

  const testData = {
    username: 'endpoint_test',
    password: 'EndpointTest123!',
    database: 'shakatogatt_suite-353039349811'
  };

  for (const endpoint of endpoints) {
    const url = endpoint.replace('{packageId}', PACKAGE_ID);
    console.log(`Testing: POST ${url}`);
    
    try {
      const result = await client.post(url, testData);
      console.log(`  ✅ SUCCESS (${result.status}):`, result.data);
      console.log('  🎉 Found working endpoint!');
      break;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.status}`);
    }
  }
}

await testDifferentFormats();
await testAlternativeEndpoints();