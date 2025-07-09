import { spawn } from 'child_process';

// Validate credentials
if (!process.env.TWENTYI_API_KEY || !process.env.TWENTYI_OAUTH_KEY || !process.env.TWENTYI_COMBINED_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - TWENTYI_API_KEY');
  console.error('   - TWENTYI_OAUTH_KEY');
  console.error('   - TWENTYI_COMBINED_KEY');
  process.exit(1);
}

const env = {
  ...process.env,
  TWENTYI_API_KEY: process.env.TWENTYI_API_KEY,
  TWENTYI_OAUTH_KEY: process.env.TWENTYI_OAUTH_KEY,
  TWENTYI_COMBINED_KEY: process.env.TWENTYI_COMBINED_KEY
};

console.log('🔍 Testing MySQL API Endpoints\n');

// Test existing MySQL users
async function testGetMysqlUsers() {
  return new Promise((resolve) => {
    const client = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env
    });

    client.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_mysql_users',
        arguments: { 
          package_id: '3302301'
        }
      }
    }) + '\n');

    let buffer = '';
    client.stdout.on('data', (data) => {
      buffer += data.toString();
    });

    client.on('close', () => {
      console.log('✅ GET MySQL Users Response:');
      if (buffer.includes('error')) {
        console.log('❌ FAILED:', buffer);
      } else {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.result && parsed.result.content) {
            const users = JSON.parse(parsed.result.content[0].text);
            console.log(`Found ${users.length} users:`);
            users.forEach(user => {
              console.log(`- ${user.username}: ${user.database || 'N/A'}`);
            });
          }
        } catch (e) {
          console.log('Parse error:', e.message);
          console.log('Raw:', buffer);
        }
      }
      resolve();
    });

    setTimeout(() => {
      client.kill();
      resolve();
    }, 8000);
  });
}

await testGetMysqlUsers();