#!/bin/bash

# Script to organize root JavaScript files into proper directories
# This will move the various test and automation scripts to appropriate locations

echo "🧹 Organizing root directory JavaScript files..."

# Create organized directory structure
mkdir -p scripts/wordpress
mkdir -p scripts/testing
mkdir -p scripts/automation
mkdir -p scripts/deployment
mkdir -p scripts/deprecated

# WordPress deployment scripts
echo "📁 Moving WordPress deployment scripts..."
mv check-domain-status.js scripts/wordpress/ 2>/dev/null || echo "check-domain-status.js not found"
mv complete-wordpress-deployment.js scripts/wordpress/ 2>/dev/null || echo "complete-wordpress-deployment.js not found"
mv correct-wordpress-install.js scripts/wordpress/ 2>/dev/null || echo "correct-wordpress-install.js not found"
mv deploy-wordpress-corrected.js scripts/wordpress/ 2>/dev/null || echo "deploy-wordpress-corrected.js not found"
mv deploy-wordpress.js scripts/wordpress/ 2>/dev/null || echo "deploy-wordpress.js not found"
mv diagnose-wordpress-conflict.js scripts/wordpress/ 2>/dev/null || echo "diagnose-wordpress-conflict.js not found"
mv fixed-wordpress-install.js scripts/wordpress/ 2>/dev/null || echo "fixed-wordpress-install.js not found"
mv install-wordpress.js scripts/wordpress/ 2>/dev/null || echo "install-wordpress.js not found"
mv setup-subdomain-wordpress.js scripts/wordpress/ 2>/dev/null || echo "setup-subdomain-wordpress.js not found"
mv use-mcp-subdomain.js scripts/wordpress/ 2>/dev/null || echo "use-mcp-subdomain.js not found"
mv wordpress-suitecrm-format.js scripts/wordpress/ 2>/dev/null || echo "wordpress-suitecrm-format.js not found"

# Testing scripts
echo "🧪 Moving testing scripts..."
mv test-api-connection.js scripts/testing/ 2>/dev/null || echo "test-api-connection.js not found"
mv test-mysql-user.js scripts/testing/ 2>/dev/null || echo "test-mysql-user.js not found"
mv check-hosting-packages.js scripts/testing/ 2>/dev/null || echo "check-hosting-packages.js not found"
mv debug-package.js scripts/testing/ 2>/dev/null || echo "debug-package.js not found"

# Database and MySQL scripts
echo "🗄️ Moving database scripts..."
mv create-mysql-user.js scripts/automation/ 2>/dev/null || echo "create-mysql-user.js not found"

# Deployment scripts
echo "🚀 Moving deployment scripts..."
mv mcp-deployment.js scripts/deployment/ 2>/dev/null || echo "mcp-deployment.js not found"
mv real-deployment.js scripts/deployment/ 2>/dev/null || echo "real-deployment.js not found"

# Email and SSL setup scripts
echo "📧 Moving configuration scripts..."
mv setup-email-accounts.js scripts/automation/ 2>/dev/null || echo "setup-email-accounts.js not found"
mv setup-ssl-performance.js scripts/automation/ 2>/dev/null || echo "setup-ssl-performance.js not found"

echo "✅ Root directory cleanup complete!"
echo ""
echo "📂 Files organized into:"
echo "  scripts/wordpress/     - WordPress deployment and management scripts"
echo "  scripts/testing/       - API testing and validation scripts"
echo "  scripts/automation/    - General automation scripts"
echo "  scripts/deployment/    - Deployment orchestration scripts"
echo ""
echo "🔍 Run 'ls scripts/*/' to see organized files"