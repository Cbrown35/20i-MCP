#!/bin/bash

# SuiteCRM CLI Setup Automation
# Completes the SuiteCRM installation using curl commands

echo "🚀 SuiteCRM CLI Setup Automation"
echo "================================="
echo ""

SUITECRM_URL="https://shakatogatt.dzind.com/suitecrm"
COOKIE_JAR="/tmp/suitecrm_cookies.txt"

# Database configuration from API response
DB_HOST="sdb-86.hosting.stackcp.net"
DB_NAME="suitecrm-3531303093b9"
DB_USER="suitecrm-3531303093b9"
DB_PASS="7bc988aff537"

# Admin configuration
ADMIN_USER="admin"
ADMIN_PASS="Admin2024!Suite#"
ADMIN_EMAIL="admin@shakatogatt.dzind.com"

echo "📋 Configuration:"
echo "   URL: $SUITECRM_URL"
echo "   Database: $DB_NAME"
echo "   Admin User: $ADMIN_USER"
echo ""

# Function to extract form tokens
extract_token() {
    local content="$1"
    local token=$(echo "$content" | grep -o 'name="[^"]*token[^"]*" value="[^"]*"' | sed 's/.*value="\([^"]*\)".*/\1/')
    echo "$token"
}

# Step 1: Get initial installer page and session
echo "📋 Step 1: Getting installer page..."
response=$(curl -k -s -c "$COOKIE_JAR" "$SUITECRM_URL/install.php")

if [[ $response == *"SuiteCRM"* ]]; then
    echo "✅ Installer page loaded"
    
    # Check if installation is already complete
    if [[ $response == *"login"* ]] || [[ $response != *"install"* ]]; then
        echo "🎉 Installation appears to be complete!"
        echo "   Try accessing: $SUITECRM_URL"
        exit 0
    fi
else
    echo "❌ Failed to load installer page"
    exit 1
fi

# Step 2: Submit initial configuration
echo ""
echo "📋 Step 2: Starting silent installation..."

# Create complete configuration in one step
curl -k -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -d "goto=SilentInstall" \
    -d "cli_install=1" \
    -d "license_accepted=true" \
    -d "setup_db_host_name=$DB_HOST" \
    -d "setup_db_port_num=3306" \
    -d "setup_db_database_name=$DB_NAME" \
    -d "setup_db_admin_user_name=$DB_USER" \
    -d "setup_db_admin_password=$DB_PASS" \
    -d "setup_db_user_name=$DB_USER" \
    -d "setup_db_password=$DB_PASS" \
    -d "setup_db_type=mysql" \
    -d "setup_db_pop_demo=no" \
    -d "setup_db_create_database=false" \
    -d "setup_db_create_sugarsales_user=false" \
    -d "setup_site_admin_user_name=$ADMIN_USER" \
    -d "setup_site_admin_password=$ADMIN_PASS" \
    -d "setup_site_admin_password_retype=$ADMIN_PASS" \
    -d "setup_site_admin_user_firstname=Admin" \
    -d "setup_site_admin_user_lastname=User" \
    -d "setup_site_admin_user_email=$ADMIN_EMAIL" \
    -d "setup_site_url=$SUITECRM_URL" \
    -d "setup_site_session_path=" \
    -d "setup_site_log_dir=" \
    -d "setup_site_log_file=suitecrm.log" \
    -d "setup_site_specify_guid=1" \
    -d "setup_site_guid=suite-$(date +%s)" \
    -d "install_type=full" \
    -d "next=Install" \
    "$SUITECRM_URL/install.php" > /tmp/install_response.html

echo "✅ Configuration submitted"

# Step 3: Wait and check installation status
echo ""
echo "📋 Step 3: Waiting for installation to complete..."
sleep 10

# Check if installation completed
for i in {1..30}; do
    echo "   Checking installation status... ($i/30)"
    
    response=$(curl -k -s -b "$COOKIE_JAR" "$SUITECRM_URL/")
    
    if [[ $response == *"login"* ]] || [[ $response == *"Login"* ]]; then
        echo "🎉 Installation completed successfully!"
        echo ""
        echo "📋 SuiteCRM is now ready!"
        echo "   🌐 URL: $SUITECRM_URL"
        echo "   👤 Username: $ADMIN_USER"
        echo "   🔑 Password: $ADMIN_PASS"
        echo "   📧 Email: $ADMIN_EMAIL"
        echo ""
        echo "📋 Next Steps:"
        echo "1. ✅ Login and verify installation"
        echo "2. 🔒 Configure SSL certificate"
        echo "3. 🎓 Install Students Management plugin"
        echo "4. ⚙️  Configure security settings"
        
        # Cleanup
        rm -f "$COOKIE_JAR" /tmp/install_response.html
        exit 0
    fi
    
    if [[ $response != *"install"* ]] && [[ $response != *"redirect"* ]]; then
        echo "⚠️  Unexpected response, but continuing..."
    fi
    
    sleep 5
done

echo "⚠️  Installation may still be in progress"
echo "   Please check manually: $SUITECRM_URL"

# Cleanup
rm -f "$COOKIE_JAR" /tmp/install_response.html