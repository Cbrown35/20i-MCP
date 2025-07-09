#\!/bin/bash

# GitHub Wiki Upload Script for 20i MCP Server
# This script uploads all wiki pages to the GitHub repository wiki

REPO_URL="https://github.com/Cbrown35/20i-MCP"
WIKI_REPO="${REPO_URL}.wiki.git"

# Clone the wiki repository
echo "Cloning GitHub wiki repository..."
git clone "$WIKI_REPO" temp-wiki

# Copy all wiki files
echo "Copying wiki files..."
cp wiki/*.md temp-wiki/

# Commit and push to GitHub wiki
cd temp-wiki
git add .
git commit -m "Complete 20i MCP Server Wiki Documentation

- Home page with comprehensive navigation
- Base API Tools documentation (271 tools)
- Enhancement Tools documentation (70 tools)
- Tool Categories with complete organization
- Installation Guide with step-by-step setup
- Professional documentation structure"

git push origin main

cd ..
rm -rf temp-wiki

echo "✅ Wiki uploaded successfully to GitHub\!"
echo "📚 View at: ${REPO_URL}/wiki"
