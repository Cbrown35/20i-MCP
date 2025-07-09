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

console.log('🔍 Testing Database+User Creation Method\n');

const client = axios.create({
  baseURL: 'https://api.20i.com',
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
  },
  timeout: 10000
});

// Test the database creation endpoint that also creates a user
async function testDatabaseUserCreation() {
  console.log('Testing MySQL Database Creation with User...');
  console.log('Endpoint: POST /package/{packageId}/web/mysqlDatabases');
  console.log('Description: Create a MySQL database and a user with the same name');
  
  try {
    const result = await client.post(`/package/${PACKAGE_ID}/web/mysqlDatabases`, {
      name: 'test_db_user',
      password: 'TestDBUser123!',
      allow_random: true  // Allow random suffix if name is taken
    });
    
    console.log('✅ SUCCESS:', result.status);
    console.log('Result:', result.data);
    console.log('🎉 This method creates both database AND user!');
    
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data);
  }
}

// Test if we can create additional users for existing database
async function testAdditionalUserCreation() {
  console.log('\\nTesting Additional User Creation for Existing Database...');
  
  // First, let's see what databases exist
  try {
    console.log('1. Getting existing databases...');
    const dbResult = await client.get(`/package/${PACKAGE_ID}/web/mysqlDatabases`);
    console.log('Databases found:', dbResult.data?.length || 0);
    
    if (dbResult.data && dbResult.data.length > 0) {
      const targetDb = dbResult.data.find(db => db.name.includes('shakatogatt_suite'));
      if (targetDb) {
        console.log('Target database:', targetDb.name);
        
        // Now try to create a user for this existing database
        console.log('\\n2. Creating user for existing database...');
        const userResult = await client.post(`/package/${PACKAGE_ID}/web/mysqlUsers`, {
          username: 'additional_user',
          password: 'AdditionalUser123!',
          database: targetDb.name
        });
        
        console.log('✅ User creation SUCCESS:', userResult.status);
        console.log('User result:', userResult.data);
      }
    }
    
  } catch (error) {
    console.log('❌ User creation FAILED:', error.response?.status, error.response?.data);
  }
}

// Test the grant method after creating user via database method
async function testGrantAfterDatabaseCreation() {
  console.log('\\n🔐 Testing Grant Method for Database Access...');
  
  try {
    const grantResult = await client.post(`/package/${PACKAGE_ID}/web/mysqlGrantUserDatabase`, {
      username: 'shakatogatt_user',  // The manually created user
      database: 'shakatogatt_suite-353039349811'
    });
    
    console.log('✅ Grant SUCCESS:', grantResult.status);
    console.log('Grant result:', grantResult.data);
    
  } catch (error) {
    console.log('❌ Grant FAILED:', error.response?.status, error.response?.data);
  }
}

await testDatabaseUserCreation();
await testAdditionalUserCreation(); 
await testGrantAfterDatabaseCreation();