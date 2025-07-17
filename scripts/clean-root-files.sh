#!/bin/bash

# Clean Root Directory Files Script
# Removes unused .js and .md files from the root directory

echo "🧹 Cleaning root directory files..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

echo "📋 Files to be cleaned from root directory:"
echo ""

# Function to safely delete file
delete_file() {
    local file=$1
    local reason=$2
    
    if [ -f "$file" ]; then
        rm "$file"
        echo "   ✅ Deleted $file ($reason)"
    else
        echo "   ⚠️  $file not found (may already be deleted)"
    fi
}

# Function to move file if it exists
move_file() {
    local file=$1
    local destination=$2
    local reason=$3
    
    if [ -f "$file" ]; then
        mv "$file" "$destination"
        echo "   ✅ Moved $file → $destination ($reason)"
    else
        echo "   ⚠️  $file not found (may already be moved)"
    fi
}

# Delete temporary/old markdown files
echo "🗑️  Deleting temporary markdown files:"
delete_file "AUTOMATION_STATUS_FINAL.md" "old automation status"
delete_file "CLEANUP_PLAN.md" "temporary cleanup documentation"
delete_file "CLEANUP_STATUS.md" "temporary cleanup documentation"
delete_file "DEPLOYMENT_COMPLETE.md" "old deployment notes"
delete_file "DEPLOYMENT_SUMMARY.md" "old deployment notes"
delete_file "REFACTORING_ASSESSMENT.md" "temporary refactoring notes"
delete_file "REFACTORING_PROGRESS.md" "temporary refactoring notes"
delete_file "ROOT_CLEANUP_SUMMARY.md" "temporary cleanup documentation"
delete_file "TODAY_SESSION_INDEX.md" "temporary session notes"
delete_file "WORDPRESS_DEPLOYMENT_PLAN.md" "old deployment plan"

echo ""

# Move remaining JavaScript files to organized directories
echo "📦 Moving remaining JavaScript files:"

# Ensure directories exist
mkdir -p scripts/wordpress
mkdir -p scripts/testing
mkdir -p scripts/automation
mkdir -p scripts/deployment

# WordPress scripts
move_file "correct-wordpress-install.js" "scripts/wordpress/" "WordPress automation"
move_file "deploy-wordpress-corrected.js" "scripts/wordpress/" "WordPress deployment"
move_file "deploy-wordpress.js" "scripts/wordpress/" "WordPress deployment"
move_file "diagnose-wordpress-conflict.js" "scripts/wordpress/" "WordPress troubleshooting"
move_file "fixed-wordpress-install.js" "scripts/wordpress/" "WordPress fixes"
move_file "setup-subdomain-wordpress.js" "scripts/wordpress/" "WordPress subdomain setup"
move_file "use-mcp-subdomain.js" "scripts/wordpress/" "MCP WordPress setup"
move_file "wordpress-suitecrm-format.js" "scripts/wordpress/" "WordPress SuiteCRM integration"

# Testing scripts
move_file "check-hosting-packages.js" "scripts/testing/" "package testing"
move_file "debug-package.js" "scripts/testing/" "package debugging"
move_file "test-mysql-user.js" "scripts/testing/" "database testing"

# Automation scripts
move_file "setup-ssl-performance.js" "scripts/automation/" "SSL automation"

# Deployment scripts
move_file "real-deployment.js" "scripts/deployment/" "deployment orchestration"

echo ""

# Check what's left in root
echo "🔍 Remaining files in root directory:"
echo ""

js_count=$(find . -maxdepth 1 -name "*.js" ! -name "jest.config.js" | wc -l)
md_count=$(find . -maxdepth 1 -name "*.md" | wc -l)

if [ "$js_count" -gt 0 ]; then
    echo "📄 JavaScript files:"
    find . -maxdepth 1 -name "*.js" ! -name "jest.config.js" -exec basename {} \;
    echo ""
fi

echo "📝 Markdown files (should only be essential ones):"
find . -maxdepth 1 -name "*.md" -exec basename {} \;

echo ""
echo "✅ Root directory cleanup completed!"
echo ""
echo "📊 Summary:"
echo "   • Deleted 10 temporary markdown files"
echo "   • Moved 12 JavaScript files to organized directories"
echo "   • Kept essential project files in root"
echo ""
echo "📂 Root should now contain only:"
echo "   • CHANGELOG.md, CLAUDE.md, CLAUDE.local.md, CONTRIBUTING.md, README.md"
echo "   • jest.config.js"
echo "   • Essential project files (package.json, tsconfig.json, etc.)"