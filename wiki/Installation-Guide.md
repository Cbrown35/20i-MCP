# Installation Guide

Complete step-by-step guide to install and configure the 20i MCP Server for AI-powered hosting management.

## 📋 **Prerequisites**

### System Requirements
- **Node.js**: Version 18.x or later
- **npm**: Version 8.x or later (comes with Node.js)
- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 512MB RAM available
- **Storage**: 100MB free disk space

### 20i Account Requirements
- **20i Reseller Account**: Active reseller account with 20i
- **API Access**: Enabled API access in your 20i account
- **API Credentials**: Valid API keys from 20i control panel

---

## 🚀 **Installation Methods**

### Method 1: NPM Installation (Recommended)

```bash
# Install globally for system-wide access
npm install -g 20i-mcp-server

# Or install locally in your project
npm install 20i-mcp-server
```

### Method 2: From Source

```bash
# Clone the repository
git clone https://github.com/Cbrown35/20i-MCP.git
cd 20i-MCP

# Install dependencies
npm install

# Build the project
npm run build
```

### Method 3: Direct Download

1. Download the latest release from [GitHub Releases](https://github.com/Cbrown35/20i-MCP/releases)
2. Extract the archive
3. Run `npm install` in the extracted directory
4. Run `npm run build` to compile

---

## 🔑 **API Credentials Setup**

### Step 1: Obtain 20i API Credentials

1. **Log into your 20i reseller control panel**
2. **Navigate to API section**:
   - Go to `Settings` → `API Access`
   - Enable API access if not already enabled
3. **Generate API keys**:
   - Create or retrieve your `API Key`
   - Create or retrieve your `OAuth Key`
   - Create or retrieve your `Combined Key`

### Step 2: Configure Environment Variables

Create a `.env` file in your project directory or set system environment variables:

```bash
# .env file
TWENTYI_API_KEY=your_api_key_here
TWENTYI_OAUTH_KEY=your_oauth_key_here
TWENTYI_COMBINED_KEY=your_combined_key_here
```

### Step 3: Alternative Configuration Methods

#### Option A: Environment Variables (Recommended)
```bash
# Linux/macOS
export TWENTYI_API_KEY="your_api_key_here"
export TWENTYI_OAUTH_KEY="your_oauth_key_here"
export TWENTYI_COMBINED_KEY="your_combined_key_here"

# Windows
set TWENTYI_API_KEY=your_api_key_here
set TWENTYI_OAUTH_KEY=your_oauth_key_here
set TWENTYI_COMBINED_KEY=your_combined_key_here
```

#### Option B: Configuration File
Create an `ignor.txt` file in the project root:
```
TWENTYI_API_KEY=your_api_key_here
TWENTYI_OAUTH_KEY=your_oauth_key_here
TWENTYI_COMBINED_KEY=your_combined_key_here
```

---

## ⚙️ **Configuration**

### Basic Configuration

The MCP server uses sensible defaults but can be customized:

```javascript
// config.js (optional)
module.exports = {
  // Server configuration
  server: {
    timeout: 30000,        // 30 second timeout
    retries: 3,            // Retry failed requests 3 times
    rateLimit: 100,        // Max 100 requests per minute
  },
  
  // Logging configuration
  logging: {
    level: 'info',         // Log level: debug, info, warn, error
    format: 'json',        // Log format: json, text
  },
  
  // Error handling
  errors: {
    sanitize: true,        // Sanitize error messages
    includeStack: false,   // Include stack traces in errors
  }
};
```

### Advanced Configuration

```javascript
// advanced-config.js
module.exports = {
  // API client configuration
  api: {
    baseURL: 'https://api.20i.com',
    timeout: 30000,
    headers: {
      'User-Agent': '20i-mcp-server/1.6.0',
    },
  },
  
  // Cache configuration
  cache: {
    enabled: true,
    ttl: 300,              // 5 minutes
    maxSize: 100,          // Max 100 cached responses
  },
  
  // Security configuration
  security: {
    validateSSL: true,
    allowInsecure: false,
    maxRequestSize: '10mb',
  }
};
```

---

## 🔌 **Integration Setup**

### Claude Desktop Integration

1. **Install Claude Desktop** from Anthropic
2. **Configure MCP Server** in Claude Desktop settings:

```json
{
  "mcpServers": {
    "20i-hosting": {
      "command": "20i-mcp-server",
      "env": {
        "TWENTYI_API_KEY": "your_api_key_here",
        "TWENTYI_OAUTH_KEY": "your_oauth_key_here",
        "TWENTYI_COMBINED_KEY": "your_combined_key_here"
      }
    }
  }
}
```

3. **Restart Claude Desktop** to load the MCP server

### Custom MCP Client Integration

```javascript
// example-client.js
import { MCPClient } from '@modelcontextprotocol/client';
import { StdioTransport } from '@modelcontextprotocol/client/stdio';

async function setupMCPClient() {
  const transport = new StdioTransport({
    command: '20i-mcp-server',
    env: {
      TWENTYI_API_KEY: 'your_api_key_here',
      TWENTYI_OAUTH_KEY: 'your_oauth_key_here',
      TWENTYI_COMBINED_KEY: 'your_combined_key_here'
    }
  });
  
  const client = new MCPClient({
    name: "20i-hosting-client",
    version: "1.0.0"
  }, {
    capabilities: {
      tools: {}
    }
  });
  
  await client.connect(transport);
  return client;
}
```

---

## ✅ **Verification**

### Test Installation

```bash
# Test the server starts without errors
20i-mcp-server --version

# Test with minimal configuration
node -e "
const server = require('20i-mcp-server');
console.log('Server loaded successfully');
"
```

### Test API Connection

```bash
# Create a test script
cat > test-connection.js << 'EOF'
const { TwentyIClient } = require('20i-mcp-server');

async function testConnection() {
  try {
    const client = new TwentyIClient();
    const info = await client.getResellerInfo();
    console.log('✅ API connection successful');
    console.log('Account ID:', info.id || 'Connected');
  } catch (error) {
    console.error('❌ API connection failed:', error.message);
  }
}

testConnection();
EOF

# Run the test
node test-connection.js
```

### Verify Tool Availability

Test that all tools are available:

```javascript
// verify-tools.js
import { server } from '20i-mcp-server';

async function verifyTools() {
  const response = await server.listTools();
  console.log(`✅ ${response.tools.length} tools available`);
  
  // Test categories
  const categories = {
    'VPS Management': response.tools.filter(t => t.name.includes('vps')).length,
    'Domain Management': response.tools.filter(t => t.name.includes('domain')).length,
    'Email Management': response.tools.filter(t => t.name.includes('email')).length,
    'SSL Certificates': response.tools.filter(t => t.name.includes('ssl')).length,
  };
  
  console.log('Tool categories:', categories);
}

verifyTools();
```

---

## 🔧 **Troubleshooting**

### Common Issues

#### 1. "Failed to load credentials" Error
```bash
# Check environment variables
echo $TWENTYI_API_KEY
echo $TWENTYI_OAUTH_KEY
echo $TWENTYI_COMBINED_KEY

# Verify .env file exists and is readable
ls -la .env
cat .env
```

#### 2. "API connection failed" Error
```bash
# Test API credentials manually
curl -H "Authorization: Bearer $(echo -n $TWENTYI_API_KEY | base64)" \
     https://api.20i.com/reseller
```

#### 3. "Module not found" Error
```bash
# Reinstall dependencies
npm install

# Clear npm cache
npm cache clean --force

# Rebuild the project
npm run build
```

#### 4. Permission Errors
```bash
# Linux/macOS: Fix permissions
chmod +x node_modules/.bin/20i-mcp-server

# Windows: Run as administrator
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
export DEBUG=20i-mcp-server:*

# Or use logging configuration
export TWENTYI_LOG_LEVEL=debug

# Run with verbose output
20i-mcp-server --verbose
```

### Network Issues

```bash
# Test connectivity to 20i API
curl -I https://api.20i.com

# Check DNS resolution
nslookup api.20i.com

# Test with proxy (if applicable)
export HTTPS_PROXY=http://your-proxy:8080
```

---

## 📊 **Performance Optimization**

### Memory Usage
```bash
# Monitor memory usage
node --max-old-space-size=512 20i-mcp-server

# For production environments
node --max-old-space-size=1024 20i-mcp-server
```

### Connection Pooling
```javascript
// config.js
module.exports = {
  api: {
    pool: {
      max: 10,           // Max 10 concurrent connections
      min: 2,            // Min 2 persistent connections
      timeout: 30000,    // 30 second timeout
    }
  }
};
```

---

## 🔄 **Updates**

### Updating the MCP Server

```bash
# NPM installation update
npm update -g 20i-mcp-server

# Check current version
20i-mcp-server --version

# Check for available updates
npm outdated -g 20i-mcp-server
```

### Source Installation Update

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart your MCP client
```

---

## 📚 **Next Steps**

After successful installation:

1. **Explore Tools**: Review the [Tool Categories](Tool-Categories) to understand available functionality
2. **Try Examples**: Follow the [Usage Examples](Usage-Examples) for common tasks
3. **Configure Automation**: Set up [Automation Workflows](Automation-Workflows) for your hosting needs
4. **Join Community**: Report issues and contribute at [GitHub Repository](https://github.com/Cbrown35/20i-MCP)

---

## 🆘 **Support**

- **Documentation**: [Wiki Home](Home)
- **Issues**: [GitHub Issues](https://github.com/Cbrown35/20i-MCP/issues)
- **API Reference**: [Complete API Docs](API-Reference)
- **20i Support**: [20i Official Support](https://20i.com/support)

---

*Installation complete! You now have access to 341 powerful tools for AI-powered hosting management.*