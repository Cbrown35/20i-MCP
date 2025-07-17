#!/bin/bash

# Create archive directories
mkdir -p archive/temp
mkdir -p archive/documentation
mkdir -p archive/cleanup-logs

# Move loose JS files to appropriate directories
mv check-domain-status.js scripts/wordpress/ 2>/dev/null || true
mv check-hosting-packages.js scripts/ 2>/dev/null || true
mv complete-wordpress-deployment.js scripts/wordpress/ 2>/dev/null || true
mv correct-wordpress-install.js scripts/wordpress/ 2>/dev/null || true
mv create-mysql-user.js scripts/automation/ 2>/dev/null || true
mv deploy-wordpress-corrected.js scripts/wordpress/ 2>/dev/null || true
mv deploy-wordpress.js scripts/wordpress/ 2>/dev/null || true
mv diagnose-wordpress-conflict.js scripts/wordpress/ 2>/dev/null || true
mv fixed-wordpress-install.js scripts/wordpress/ 2>/dev/null || true
mv install-wordpress.js scripts/wordpress/ 2>/dev/null || true
mv mcp-deployment.js scripts/deployment/ 2>/dev/null || true
mv real-deployment.js scripts/deployment/ 2>/dev/null || true
mv setup-email-accounts.js scripts/automation/ 2>/dev/null || true
mv setup-ssl-performance.js scripts/automation/ 2>/dev/null || true
mv setup-subdomain-wordpress.js scripts/wordpress/ 2>/dev/null || true
mv test-api-connection.js scripts/testing/ 2>/dev/null || true
mv test-mysql-user.js scripts/testing/ 2>/dev/null || true
mv use-mcp-subdomain.js scripts/wordpress/ 2>/dev/null || true
mv wordpress-suitecrm-format.js scripts/wordpress/ 2>/dev/null || true

# Move cleanup and documentation files
mv AUTOMATION_STATUS_FINAL.md archive/documentation/ 2>/dev/null || true
mv CLEANUP_COMPLETE.md archive/cleanup-logs/ 2>/dev/null || true
mv CLEANUP_EXECUTION_LOG.md archive/cleanup-logs/ 2>/dev/null || true
mv CLEANUP_PLAN.md archive/cleanup-logs/ 2>/dev/null || true
mv CLEANUP_ROOT_FILES.md archive/cleanup-logs/ 2>/dev/null || true
mv CLEANUP_STATUS.md archive/cleanup-logs/ 2>/dev/null || true
mv COMPLETE_CLEANUP_COMMANDS.md archive/cleanup-logs/ 2>/dev/null || true
mv DELETE_TEMP_FILES.md archive/cleanup-logs/ 2>/dev/null || true
mv DEPLOYMENT_COMPLETE.md archive/documentation/ 2>/dev/null || true
mv DEPLOYMENT_SUMMARY.md archive/documentation/ 2>/dev/null || true
mv FINAL_CLEANUP_SUMMARY.md archive/cleanup-logs/ 2>/dev/null || true
mv REFACTORING_ASSESSMENT.md archive/documentation/ 2>/dev/null || true
mv REFACTORING_PROGRESS.md archive/documentation/ 2>/dev/null || true
mv ROOT_CLEANUP_SUMMARY.md archive/cleanup-logs/ 2>/dev/null || true
mv SIMPLE_CLEANUP.txt archive/cleanup-logs/ 2>/dev/null || true
mv TODAY_SESSION_INDEX.md archive/documentation/ 2>/dev/null || true
mv WORDPRESS_DEPLOYMENT_PLAN.md archive/documentation/ 2>/dev/null || true

# Move shell scripts
mv cleanup-now.sh scripts/ 2>/dev/null || true

echo "File organization complete!"