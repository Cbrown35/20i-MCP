# Contributing to 20i MCP Server

Thank you for your interest in contributing to the 20i MCP Server! This project represents the cutting edge of AI-powered hosting management, and we welcome contributions from the community.

## How to Contribute

### Reporting Issues
- Use the GitHub issue tracker to report bugs
- Provide detailed reproduction steps
- Include your environment details (Node.js version, OS, etc.)

### Feature Requests
- Open an issue to discuss new features before implementation
- Consider the impact on 20i customers and hosting workflows
- Provide use cases and business justification

### Code Contributions

1. **Fork the Repository**
   ```bash
   git fork https://github.com/Cbrown35/20i-MCP.git
   cd 20i-MCP
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Development Setup**
   ```bash
   npm install
   npm run build
   ```

4. **Make Your Changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

5. **Test Your Changes**
   ```bash
   npm run build
   npm run dev  # Test locally
   ```

6. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

7. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Include JSDoc comments for public APIs
- Use meaningful variable and function names

### Testing
- Test all new MCP tools thoroughly
- Verify API integrations work correctly
- Test error handling and edge cases

### Documentation
- Update README.md for new features
- Add examples for new MCP tools
- Document any breaking changes

## Project Structure

```
src/
├── index.ts          # Main MCP server implementation (303 tools)
├── core/             # Core functionality
│   ├── client.ts     # API client implementation
│   ├── types.ts      # TypeScript type definitions
│   ├── validation.ts # Input validation utilities
│   └── errors.ts     # Error handling
├── modules/          # Feature modules
│   ├── domains.ts    # Domain management
│   └── packages.ts   # Package management
└── utils/            # Utility functions

tests/                # Test files
docs/                 # Additional documentation
archive/              # Gitignored - deployment scripts
workspace/            # Gitignored - working files
```

## Security Guidelines

This is a **public repository**. Please follow these security practices:

1. **Never commit credentials** - Use environment variables only
2. **No customer data** - Keep all examples generic
3. **Review before committing** - Check for sensitive information
4. **Use .gitignore** - Ensure private files stay private
5. **Report vulnerabilities** - Use GitHub Security Advisories

## MCP Tool Development

When adding new MCP tools:

1. Define the tool in the `ListToolsRequestSchema` handler
2. Implement the tool logic in the `CallToolRequestSchema` handler
3. Add comprehensive error handling
4. Update documentation with usage examples
5. Test with multiple AI assistants

### Tool Naming Convention
- Use snake_case for tool names
- Be descriptive and specific
- Group related functionality logically

Example:
- `get_domain_info` ✅
- `getDomainInfo` ❌
- `domain` ❌

## Business Considerations

This project aims to showcase innovative AI integration for 20i hosting services. When contributing:

- Consider the business value for 20i customers
- Think about support and maintenance implications
- Ensure security best practices
- Maintain professional code quality

## Getting Help

- Review existing issues and documentation
- Reach out via GitHub issues for questions
- Join discussions about new features and improvements

## Recognition

Contributors will be recognized in the project documentation and commit history. This project has the potential to influence the hosting industry's adoption of AI technologies.

---

Thank you for helping to advance AI-powered hosting management!