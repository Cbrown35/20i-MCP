import axios from 'axios';

// Check for required environment variables
if (!process.env.TWENTYI_API_KEY) {
  console.error('❌ Error: TWENTYI_API_KEY environment variable is required');
  console.error('Please set it using: export TWENTYI_API_KEY="your_api_key_here"');
  process.exit(1);
}

// Test different base URLs for services
const API_BASES = [
  'https://api.20i.com',           // Current
  'https://services.20i.com',      // Services subdomain
  'https://api.20i.com/services',  // Services path
];

const API_KEY = process.env.TWENTYI_API_KEY;
const authHeader = `Bearer ${Buffer.from(API_KEY).toString('base64')}`;

console.log('🔍 Testing Services Endpoint Structures\n');

async function testServicesEndpoints() {
  for (const baseURL of API_BASES) {
    console.log(`Testing base URL: ${baseURL}`);
    console.log('================================');
    
    const client = axios.create({
      baseURL,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    // Test 1: GET MySQL users
    try {
      console.log(`  GET ${baseURL}/package/3302301/web/mysqlUsers`);
      const result = await client.get('/package/3302301/web/mysqlUsers');
      console.log(`  ✅ GET Success (${result.status}): ${result.data?.length || 0} users`);
    } catch (error) {
      console.log(`  ❌ GET Failed: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    }

    // Test 2: POST create MySQL user
    try {
      console.log(`  POST ${baseURL}/package/3302301/web/mysqlUsers (create user)`);
      const result = await client.post('/package/3302301/web/mysqlUsers', {
        username: 'services_test_user',
        password: 'ServicesTest123!',
        database: 'shakatogatt_suite-353039349811'
      });
      console.log(`  ✅ POST Success (${result.status}):`, result.data);
      break; // Stop on first success
    } catch (error) {
      console.log(`  ❌ POST Failed: ${error.response?.status} - ${error.response?.data?.error?.message || error.message}`);
    }

    console.log('');
  }
}

// Also test different authentication methods
async function testAlternativeAuth() {
  console.log('\\n🔑 Testing Alternative Authentication Methods\\n');
  
  const authMethods = [
    { name: 'Base64 API Key', header: `Bearer ${Buffer.from(API_KEY).toString('base64')}` },
    { name: 'Plain API Key', header: `Bearer ${API_KEY}` },
    { name: 'Combined Key Base64', header: `Bearer ${Buffer.from(process.env.TWENTYI_COMBINED_KEY || `${process.env.TWENTYI_API_KEY}+${process.env.TWENTYI_OAUTH_KEY}`).toString('base64')}` },
    { name: 'Combined Key Plain', header: `Bearer ${process.env.TWENTYI_COMBINED_KEY || `${process.env.TWENTYI_API_KEY}+${process.env.TWENTYI_OAUTH_KEY}`}` }
  ];

  for (const auth of authMethods) {
    console.log(`Testing: ${auth.name}`);
    
    const client = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': auth.header,
        'Content-Type': 'application/json',
      },
      timeout: 5000
    });

    try {
      const result = await client.get('/package/3302301/web/mysqlUsers');
      console.log(`  ✅ Success: ${result.status}`);
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.status}`);
    }
  }
}

await testServicesEndpoints();
await testAlternativeAuth();