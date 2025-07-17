# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
20i MCP Server - Model Context Protocol server for 20i hosting API with 90.4% API coverage (303 implemented tools out of 335 total endpoints). This is a production-ready automation-focused project designed to minimize human intervention in hosting management tasks.

## Development Commands

### Build & Development
```bash
npm run build      # Compile TypeScript to /build directory
npm run dev        # Development mode with tsx hot reloading
npm run start      # Production server (node build/index.js)
tsx src/index.ts   # Alternative development command
```

### Testing & Analysis
```bash
npm test                       # Run Jest test suite
npm run test:watch             # Run tests in watch mode for development
npm run test:coverage          # Run tests with coverage reporting
scripts/check-api-coverage.sh  # Analyze API coverage and identify gaps
```

## Core Architecture

### Main Components
- **TwentyIClient Class**: Centralized API client in `src/core/client.ts` with comprehensive error handling and response validation
- **MCP Server Instance**: Main implementation in `src/index.ts` with 303 unique tools
- **Modular Architecture**: Core functionality organized in `src/core/` (client, types, validation, errors) and feature modules in `src/modules/` (domains, packages)
- **Tool Definitions**: 303 unique tools covering hosting, domains, WordPress, CDN, security, and database operations
- **Request Handlers**: Two main handlers for `ListTools` and `CallTool` operations
- **Validation System**: Comprehensive input validation utilities in `src/core/validation.ts`

### Authentication & Security
- **Environment Variables Required**: `TWENTYI_API_KEY`, `TWENTYI_OAUTH_KEY`, `TWENTYI_COMBINED_KEY`
- **Authentication Method**: Base64 Bearer token format
- **Security**: No hardcoded credentials - all authentication via environment variables
- **Input Validation**: Comprehensive parameter validation and sanitization

### API Integration Pattern
```typescript
// Standard API call pattern used throughout
const response = await this.apiClient.get(`/endpoint/${id}`, {
  headers: { Authorization: `Bearer ${encodedKey}` }
});
```

## Technology Stack
- **Framework**: @modelcontextprotocol/sdk for MCP implementation
- **HTTP Client**: axios with response interceptors for error handling
- **Language**: TypeScript with strict mode, ES2022 target, ESNext modules
- **Testing**: Jest with TypeScript preset, ESM support, coverage reporting
- **Additional Tools**: basic-ftp, node-ssh, puppeteer for automation scenarios
- **Module System**: Native ES modules with TypeScript compilation

## Key Development Patterns

### Tool Implementation Structure
1. **Tool Definition**: JSON schema-based tool specifications in tools array
2. **Request Handler**: Single switch statement in `CallTool` handler
3. **Error Handling**: Standardized McpError responses with detailed messages
4. **Response Validation**: Comprehensive JSON format validation and error recovery

### API Coverage Organization
- **Official 20i API**: 335 total endpoints (164 GET, 167 POST, 4 PATCH)
- **Implementation Status**: 303 unique tools implemented across all major categories
- **Tool Categories**: Core management, hosting packages, WordPress, CDN, databases, security

## File Structure & Key Locations
- **Main Server**: `src/index.ts` - Complete MCP server implementation
- **Core Architecture**: `src/core/` - Foundational classes (client, types, validation, errors)
- **Feature Modules**: `src/modules/` - Domain-specific functionality (domains, packages)
- **Testing**: `tests/` - Jest test suites with unit tests and helper mocks
- **Scripts**: `scripts/` - Development and automation utilities
- **API Documentation**: `/archive/gitignor_ref_folder/20i_api_doc.apib` - Official 20i API reference
- **Documentation**: `docs/` - Project documentation and implementation guides
- **Coverage Analysis**: `scripts/check-api-coverage.sh` - API coverage tracking

## Configuration Files
- **TypeScript**: `tsconfig.json` - Strict mode, ES2022 target, ESNext modules
- **Package**: `package.json` - Dependencies and build scripts
- **MCP Client**: Configure in Claude Desktop with environment variables

## Development Guidelines

### Adding New Tools
1. **Modular Approach**: Consider adding to appropriate module in `src/modules/` or core functionality
2. **Tool Definition**: Follow existing patterns in the tools array with proper input schema
3. **Handler Implementation**: Add to CallTool switch statement with comprehensive error handling
4. **Validation**: Use validation utilities from `src/core/validation.ts` for input sanitization
5. **Testing**: Add unit tests in `tests/unit/` with appropriate mocks
6. **Documentation**: Update API coverage tracking if implementing new endpoints

### Error Handling Standards
- Use try-catch blocks with detailed error messages
- Implement response validation for all API calls
- Provide meaningful error context to users
- Handle network failures gracefully

### Testing Approach
- **Jest Configuration**: ESM preset with TypeScript support in `jest.config.js`
- **Test Structure**: Unit tests in `tests/unit/`, shared helpers in `tests/helpers/`
- **Mock Infrastructure**: Use `tests/helpers/mockClient.ts` for API client mocking
- **Test Commands**: `npm test` for single run, `npm run test:watch` for development
- **Coverage**: `npm run test:coverage` generates comprehensive coverage reports
- **Validation Testing**: Test input validation and error handling paths
- **API Integration**: Validate responses against expected formats with real API calls in `/testing-files/`

## Notable Features
- **Comprehensive WordPress Management**: 15 tools for installations, plugins, themes, staging
- **Advanced CDN Control**: 15 tools for caching, security headers, performance optimization
- **Security Management**: 13 tools for IP blocking, malware scanning, SSL certificates
- **Database Operations**: 5 tools for MySQL/MSSQL management and user permissions
- **Bulk Operations**: Multi-site management capabilities for enterprise scenarios

## Automation Infrastructure
The project includes extensive automation capabilities through 54 scripts in `/automation/` demonstrating:
- Multi-approach deployment strategies (API, SSH, web automation)
- Sophisticated error handling with retry logic
- MySQL Grant API discovery and implementation
- SuiteCRM deployment automation achieving 95% success rate

## Security Considerations
- Never commit API keys or credentials to the repository
- Use environment variables for all authentication
- Validate all user inputs before API calls
- Implement proper error handling to avoid information leakage
- Follow the existing base64 encoding pattern for API tokens

## Development Environment Setup
- **Node.js**: Version 18+ required for ES modules and modern features
- **TypeScript**: Strict mode enabled with ES2022 target
- **Jest**: Configured for ESM with TypeScript preset
- **Environment Variables**: Required for API authentication (see Authentication & Security section)