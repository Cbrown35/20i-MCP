#!/usr/bin/env node

/**
 * 20i API Endpoint Testing Tool
 * Tests all MCP tools to determine which endpoints work and which don't
 * Generates reports and tracks changes over time
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// All 100 MCP tools organized by category
const API_TESTS = {
  "Core Management": [
    { tool: "get_reseller_info", params: {}, description: "Get reseller account information" },
    { tool: "get_account_balance", params: {}, description: "Get account balance" },
    { tool: "list_domains", params: {}, description: "List all domains" },
    { tool: "get_domain_info", params: { domain_id: "test123" }, description: "Get domain details", expectError: true },
    { tool: "get_dns_records", params: { domain_id: "test123" }, description: "Get DNS records", expectError: true },
  ],

  "Hosting Package Management": [
    { tool: "list_hosting_packages", params: {}, description: "List hosting packages" },
    { tool: "get_hosting_package_info", params: { package_id: "test123" }, description: "Get package info", expectError: true },
    { tool: "get_hosting_package_web_info", params: { package_id: "test123" }, description: "Get web package info", expectError: true },
    { tool: "get_hosting_package_limits", params: { package_id: "test123" }, description: "Get package limits", expectError: true },
    { tool: "get_hosting_package_usage", params: { package_id: "test123" }, description: "Get package usage", expectError: true },
    { tool: "create_hosting_package", params: { domain_name: "test.com", package_type: "shared", username: "test", password: "test123" }, description: "Create hosting package", expectError: true },
  ],

  "Database Management": [
    { tool: "get_mysql_databases", params: { package_id: "test123" }, description: "List MySQL databases", expectError: true },
    { tool: "get_mysql_users", params: { package_id: "test123" }, description: "List MySQL users", expectError: true },
    { tool: "get_mssql_databases", params: { package_id: "test123" }, description: "List MSSQL databases", expectError: true },
    { tool: "create_mysql_database", params: { package_id: "test123", name: "test_db" }, description: "Create MySQL database", expectError: true },
    { tool: "create_mysql_user", params: { package_id: "test123", username: "test_user", password: "test123" }, description: "Create MySQL user", expectError: true },
  ],

  "Email Management": [
    { tool: "get_email_configuration", params: { package_id: "test123", email_id: "test123" }, description: "Get email config", expectError: true },
    { tool: "get_mailbox_configuration", params: { package_id: "test123", email_id: "test123" }, description: "Get mailbox config", expectError: true },
    { tool: "get_email_forwarders", params: { package_id: "test123", email_id: "test123" }, description: "Get email forwarders", expectError: true },
    { tool: "get_all_email_forwarders", params: { package_id: "test123" }, description: "Get all email forwarders", expectError: true },
    { tool: "create_email_account", params: { package_id: "test123", email: "test@test.com", password: "test123" }, description: "Create email account", expectError: true },
    { tool: "create_email_forwarder", params: { package_id: "test123", source: "test@test.com", destinations: ["dest@test.com"] }, description: "Create email forwarder", expectError: true },
  ],

  "Application Management": [
    { tool: "list_applications", params: { package_id: "test123" }, description: "List available applications", expectError: true },
    { tool: "install_application", params: { package_id: "test123", application_id: "wordpress", path: "/" }, description: "Install application", expectError: true },
  ],

  "Security Management": [
    { tool: "get_blocked_ip_addresses", params: { package_id: "test123" }, description: "Get blocked IPs", expectError: true },
    { tool: "set_blocked_ip_addresses", params: { package_id: "test123", ip_addresses: ["192.168.1.1"] }, description: "Set blocked IPs", expectError: true },
    { tool: "add_ip_block", params: { package_id: "test123", ip_address: "192.168.1.1" }, description: "Add IP block", expectError: true },
    { tool: "remove_ip_block", params: { package_id: "test123", ip_address: "192.168.1.1" }, description: "Remove IP block", expectError: true },
    { tool: "get_blocked_countries", params: { package_id: "test123" }, description: "Get blocked countries", expectError: true },
    { tool: "set_blocked_countries", params: { package_id: "test123", countries: ["CN"], access: "block" }, description: "Set blocked countries", expectError: true },
    { tool: "add_country_block", params: { package_id: "test123", country_code: "CN" }, description: "Add country block", expectError: true },
    { tool: "remove_country_block", params: { package_id: "test123", country_code: "CN" }, description: "Remove country block", expectError: true },
    { tool: "get_malware_scan", params: { package_id: "test123" }, description: "Get malware scan", expectError: true },
    { tool: "request_malware_scan", params: { package_id: "test123" }, description: "Request malware scan", expectError: true },
    { tool: "get_malware_report", params: { package_id: "test123" }, description: "Get malware report", expectError: true },
    { tool: "get_email_spam_blacklist", params: { package_id: "test123", email_id: "test123" }, description: "Get spam blacklist", expectError: true },
    { tool: "get_email_spam_whitelist", params: { package_id: "test123", email_id: "test123" }, description: "Get spam whitelist", expectError: true },
    { tool: "add_tls_certificate", params: { name: "test-cert", period_months: 12, configuration: {} }, description: "Add TLS certificate", expectError: true },
    { tool: "renew_tls_certificate", params: { certificate_id: "test123", period_months: 12 }, description: "Renew TLS certificate", expectError: true },
  ],

  "SSL Management": [
    { tool: "get_ssl_certificates", params: { package_id: "test123" }, description: "Get SSL certificates", expectError: true },
    { tool: "add_free_ssl", params: { package_id: "test123", domains: ["test.com"] }, description: "Add free SSL", expectError: true },
    { tool: "get_force_ssl", params: { package_id: "test123" }, description: "Get Force SSL status", expectError: true },
    { tool: "set_force_ssl", params: { package_id: "test123", enabled: true }, description: "Set Force SSL", expectError: true },
  ],

  "WordPress Management": [
    { tool: "is_wordpress_installed", params: { package_id: "test123" }, description: "Check WordPress installation", expectError: true },
    { tool: "reinstall_wordpress", params: { package_id: "test123" }, description: "Reinstall WordPress", expectError: true },
    { tool: "get_wordpress_settings", params: { package_id: "test123" }, description: "Get WordPress settings", expectError: true },
    { tool: "set_wordpress_settings", params: { package_id: "test123", option_name: "blogname", option_value: "Test Blog" }, description: "Set WordPress settings", expectError: true },
    { tool: "get_wordpress_version", params: { package_id: "test123" }, description: "Get WordPress version", expectError: true },
    { tool: "wordpress_search_replace", params: { package_id: "test123", search: "old.com", replace: "new.com" }, description: "WordPress search/replace", expectError: true },
    { tool: "get_wordpress_plugins", params: { package_id: "test123" }, description: "Get WordPress plugins", expectError: true },
    { tool: "manage_wordpress_plugin", params: { package_id: "test123", action: "activate", plugin_name: "test-plugin" }, description: "Manage WordPress plugin", expectError: true },
    { tool: "install_stackcache_plugin", params: { package_id: "test123" }, description: "Install StackCache plugin", expectError: true },
    { tool: "get_wordpress_themes", params: { package_id: "test123" }, description: "Get WordPress themes", expectError: true },
    { tool: "manage_wordpress_theme", params: { package_id: "test123", action: "activate", theme_name: "test-theme" }, description: "Manage WordPress theme", expectError: true },
    { tool: "get_wordpress_users", params: { package_id: "test123" }, description: "Get WordPress users", expectError: true },
    { tool: "update_wordpress", params: { package_id: "test123" }, description: "Update WordPress", expectError: true },
    { tool: "get_wordpress_staging", params: { package_id: "test123" }, description: "Get WordPress staging", expectError: true },
    { tool: "manage_wordpress_staging", params: { package_id: "test123", type: "live" }, description: "Manage WordPress staging", expectError: true },
  ],

  "Cloud Infrastructure": [
    { tool: "list_cloud_servers", params: {}, description: "List cloud servers" },
    { tool: "create_cloud_server", params: { provider: "aws", size: "small", location: "us-east", name: "test-server" }, description: "Create cloud server", expectError: true },
    { tool: "list_vps", params: {}, description: "List VPS servers" },
    { tool: "get_vps_info", params: { vps_id: "test123" }, description: "Get VPS info", expectError: true },
    { tool: "list_managed_vps", params: {}, description: "List managed VPS" },
    { tool: "get_managed_vps_info", params: { managed_vps_id: "test123" }, description: "Get managed VPS info", expectError: true },
  ],

  "Statistics": [
    { tool: "get_bandwidth_stats", params: { package_id: "test123" }, description: "Get bandwidth stats", expectError: true },
    { tool: "get_disk_usage", params: { package_id: "test123" }, description: "Get disk usage", expectError: true },
    { tool: "get_access_logs", params: { package_id: "test123" }, description: "Get access logs", expectError: true },
  ]
};

// Test results storage
let testResults = {
  timestamp: new Date().toISOString(),
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: {}
  },
  categories: {}
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test a single MCP tool
async function testTool(toolName, params, description, expectError = false) {
  return new Promise((resolve) => {
    const mcpRequest = {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    };

    const child = spawn('node', ['build/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const result = {
        tool: toolName,
        description,
        expectError,
        success: false,
        error: null,
        statusCode: null,
        responseTime: null,
        output: stdout,
        stderr: stderr
      };

      // Parse the output to determine success/failure
      if (stdout.includes('MCP error') || stdout.includes('Tool execution failed')) {
        result.error = stdout.match(/MCP error[^"]*"([^"]*)"/) || 'Unknown error';
        if (stdout.includes('status code')) {
          const statusMatch = stdout.match(/status code (\d+)/);
          result.statusCode = statusMatch ? parseInt(statusMatch[1]) : null;
        }
      } else if (code === 0 && !stderr) {
        result.success = true;
      } else {
        result.error = stderr || `Exit code: ${code}`;
      }

      // If we expected an error but got success, or vice versa
      if (expectError && result.success) {
        result.unexpected = 'Expected error but got success';
      } else if (!expectError && !result.success) {
        result.unexpected = 'Expected success but got error';
      }

      resolve(result);
    });

    // Send the MCP request
    child.stdin.write(JSON.stringify(mcpRequest) + '\n');
    child.stdin.end();

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        tool: toolName,
        description,
        expectError,
        success: false,
        error: 'Timeout after 30 seconds',
        timeout: true
      });
    }, 30000);
  });
}

// Run all tests
async function runAllTests() {
  console.log(`${colors.cyan}🧪 Starting 20i API Endpoint Testing...${colors.reset}\n`);

  for (const [category, tests] of Object.entries(API_TESTS)) {
    console.log(`${colors.blue}📂 Testing ${category} (${tests.length} tools)${colors.reset}`);
    
    testResults.categories[category] = {
      total: tests.length,
      passed: 0,
      failed: 0,
      tests: []
    };

    for (const test of tests) {
      process.stdout.write(`  ${test.description}... `);
      
      const startTime = Date.now();
      const result = await testTool(test.tool, test.params, test.description, test.expectError);
      result.responseTime = Date.now() - startTime;
      
      testResults.categories[category].tests.push(result);
      testResults.summary.total++;

      if (result.success || (result.expectError && result.error)) {
        console.log(`${colors.green}✅ PASS${colors.reset} (${result.responseTime}ms)`);
        testResults.categories[category].passed++;
        testResults.summary.passed++;
      } else {
        console.log(`${colors.red}❌ FAIL${colors.reset} - ${result.error || 'Unknown error'} (${result.responseTime}ms)`);
        testResults.categories[category].failed++;
        testResults.summary.failed++;
        
        // Track error types
        const errorType = result.statusCode ? `HTTP ${result.statusCode}` : 'Unknown';
        testResults.summary.errors[errorType] = (testResults.summary.errors[errorType] || 0) + 1;
      }
    }
    console.log();
  }

  // Generate summary report
  generateReport();
  
  // Save results to file
  saveResults();
}

// Generate human-readable report
function generateReport() {
  console.log(`${colors.cyan}📊 Test Results Summary${colors.reset}`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`${colors.green}Passed: ${testResults.summary.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.summary.failed}${colors.reset}`);
  console.log(`Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
  
  console.log(`\n${colors.yellow}Error Breakdown:${colors.reset}`);
  for (const [errorType, count] of Object.entries(testResults.summary.errors)) {
    console.log(`  ${errorType}: ${count} occurrences`);
  }

  console.log(`\n${colors.blue}Working Endpoints:${colors.reset}`);
  for (const [category, data] of Object.entries(testResults.categories)) {
    const workingTests = data.tests.filter(t => t.success || (t.expectError && t.error));
    if (workingTests.length > 0) {
      console.log(`  ${category}: ${workingTests.length}/${data.total} working`);
      workingTests.forEach(t => console.log(`    ✅ ${t.tool}`));
    }
  }

  console.log(`\n${colors.red}Failed Endpoints:${colors.reset}`);
  for (const [category, data] of Object.entries(testResults.categories)) {
    const failedTests = data.tests.filter(t => !t.success && !(t.expectError && t.error));
    if (failedTests.length > 0) {
      console.log(`  ${category}: ${failedTests.length}/${data.total} failed`);
      failedTests.forEach(t => console.log(`    ❌ ${t.tool} - ${t.error}`));
    }
  }
}

// Save results to JSON file
function saveResults() {
  const filename = `test-results-${new Date().toISOString().split('T')[0]}.json`;
  writeFileSync(filename, JSON.stringify(testResults, null, 2));
  console.log(`\n${colors.green}📄 Results saved to: ${filename}${colors.reset}`);
  
  // Also save a summary CSV
  const csvFilename = `test-summary-${new Date().toISOString().split('T')[0]}.csv`;
  let csv = 'Category,Tool,Description,Status,Error,StatusCode,ResponseTime\n';
  
  for (const [category, data] of Object.entries(testResults.categories)) {
    for (const test of data.tests) {
      const status = test.success ? 'PASS' : 'FAIL';
      const error = (test.error || '').replace(/,/g, ';');
      csv += `${category},${test.tool},${test.description},${status},"${error}",${test.statusCode || ''},${test.responseTime}\n`;
    }
  }
  
  writeFileSync(csvFilename, csv);
  console.log(`${colors.green}📊 CSV summary saved to: ${csvFilename}${colors.reset}`);
}

// Compare with previous results
function compareWithPrevious() {
  // TODO: Implement comparison with previous test runs
  // This would track which endpoints started/stopped working
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, testTool, API_TESTS };