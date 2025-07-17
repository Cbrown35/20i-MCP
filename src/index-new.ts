#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Import our modular components
import { TwentyIClient, toMcpError } from './core/index.js';
import { loadAllModules } from './modules/index.js';

/**
 * 20i MCP Server - Modular Implementation
 * 
 * This is a refactored version of the original monolithic server that uses
 * a modular architecture for better maintainability and testing.
 * 
 * Current modules implemented:
 * - Domains: Domain management and DNS operations
 * - Packages: Hosting package management
 * 
 * Additional modules are being extracted from the original implementation.
 */

// Initialize the 20i API client
const twentyIClient = new TwentyIClient();

// Load all modules
const { tools, handlers } = loadAllModules(twentyIClient);

// Create and configure the MCP server
const server = new Server(
  {
    name: '20i-mcp-server',
    version: '1.6.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = handlers[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    // Execute the handler
    const result = await handler(args || {});
    return result;
  } catch (error) {
    // Convert any error to MCP-compatible format
    throw toMcpError(error);
  }
});

// Main function to start the server
async function main() {
  try {
    // Log server startup information
    console.error(`20i MCP Server starting...`);
    console.error(`Loaded ${tools.length} tools from ${Object.keys(loadAllModules(twentyIClient)).length} modules`);
    console.error(`Available modules: domains, packages`);
    
    // Start the MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('20i MCP Server connected and ready');
  } catch (error) {
    console.error('Failed to start 20i MCP Server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});