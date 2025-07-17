#!/bin/bash

# Root Directory Cleanup Script
# This script moves JavaScript files from the root directory to organized subdirectories

echo "🧹 Starting root directory cleanup..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Create subdirectories if they don't exist
echo "📁 Creating organized subdirectories..."
mkdir -p scripts/wordpress
mkdir -p scripts/testing  
mkdir -p scripts/automation
mkdir -p scripts/deployment

# Function to move file if it exists
move_if_exists() {
    local file=$1
    local destination=$2
    
    if [ -f "$file" ]; then
        mv "$file" "$destination"
        echo "   ✅ Moved $file → $destination"
    else
        echo "   ⚠️  $file not found (may already be moved)"
    fi
}

# Move WordPress deployment scripts
echo ""
echo "📦 Moving WordPress deployment scripts..."
move_if_exists "check-domain-status.js" "scripts/wordpress/"
move_if_exists "complete-wordpress-deployment.js" "scripts/wordpress/"
move_if_exists "correct-wordpress-install.js" "scripts/wordpress/"
move_if_exists "deploy-wordpress-corrected.js" "scripts/wordpress/"
move_if_exists "deploy-wordpress.js" "scripts/wordpress/"
move_if_exists "diagnose-wordpress-conflict.js" "scripts/wordpress/"
move_if_exists "fixed-wordpress-install.js" "scripts/wordpress/"
move_if_exists "install-wordpress.js" "scripts/wordpress/"
move_if_exists "setup-subdomain-wordpress.js" "scripts/wordpress/"
move_if_exists "use-mcp-subdomain.js" "scripts/wordpress/"
move_if_exists "wordpress-suitecrm-format.js" "scripts/wordpress/"

# Move testing scripts
echo ""
echo "🧪 Moving testing scripts..."
move_if_exists "test-api-connection.js" "scripts/testing/"
move_if_exists "test-mysql-user.js" "scripts/testing/"
move_if_exists "check-hosting-packages.js" "scripts/testing/"
move_if_exists "debug-package.js" "scripts/testing/"

# Move automation scripts
echo ""
echo "⚙️  Moving automation scripts..."
move_if_exists "create-mysql-user.js" "scripts/automation/"
move_if_exists "setup-email-accounts.js" "scripts/automation/"
move_if_exists "setup-ssl-performance.js" "scripts/automation/"

# Move deployment scripts
echo ""
echo "🚀 Moving deployment scripts..."
move_if_exists "mcp-deployment.js" "scripts/deployment/"
move_if_exists "real-deployment.js" "scripts/deployment/"

# Check for any remaining .js files in root (excluding jest.config.js)
echo ""
echo "🔍 Checking for remaining .js files in root..."
remaining_js=$(find . -maxdepth 1 -name "*.js" ! -name "jest.config.js" | wc -l)

if [ "$remaining_js" -gt 0 ]; then
    echo "⚠️  Found remaining .js files in root:"
    find . -maxdepth 1 -name "*.js" ! -name "jest.config.js" -exec basename {} \;
    echo ""
    echo "   These may need manual review to determine appropriate location."
else
    echo "✅ No remaining .js files in root (except jest.config.js)"
fi

# Show final organization
echo ""
echo "📂 Final script organization:"
echo ""
echo "scripts/"
echo "├── wordpress/        $(ls scripts/wordpress/*.js 2>/dev/null | wc -l) files"
echo "├── testing/          $(ls scripts/testing/*.js 2>/dev/null | wc -l) files"  
echo "├── automation/       $(ls scripts/automation/*.js 2>/dev/null | wc -l) files"
echo "├── deployment/       $(ls scripts/deployment/*.js 2>/dev/null | wc -l) files"
echo "└── (existing files)  $(ls scripts/*.sh scripts/*.txt 2>/dev/null | wc -l) files"

echo ""
echo "✅ Root directory cleanup completed!"
echo ""
echo "📚 Next steps:"
echo "   1. Review moved files to ensure they're in the correct locations"
echo "   2. Update any documentation that references moved files"
echo "   3. Test key scripts to ensure they still work from new locations"
echo "   4. Consider adding scripts to .gitignore if they contain sensitive data"
echo ""
echo "📖 See README files in each scripts/ subdirectory for usage information"