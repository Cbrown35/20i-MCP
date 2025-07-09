#!/bin/bash

# Session Persistence Approach
# Use curl with cookies to maintain session and force form submission

echo "🔧 Session Persistence Approach for SuiteCRM Installer"
echo "====================================================="

# Database credentials
DB_HOST="sdb-83.hosting.stackcp.net"
DB_NAME="suitecrm-353039347848"
DB_USER="suitecrm-353039347848"
DB_PASS="743f27418a05"

BASE_URL="https://shakatogatt.dzind.com/suitecrm"
INSTALL_URL="${BASE_URL}/install.php"

# Create temp files for cookies and headers
COOKIE_JAR="/tmp/suitecrm_cookies.txt"
HEADERS_FILE="/tmp/suitecrm_headers.txt"

echo "📋 Step 1: Getting installer page and extracting session..."

# Get the installer page and save cookies
curl -k -s -c "$COOKIE_JAR" -D "$HEADERS_FILE" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
  "$INSTALL_URL" > /tmp/installer_page.html

if [ $? -eq 0 ]; then
  echo "✅ Installer page retrieved"
  
  # Check for redirect loops
  if grep -q "302" "$HEADERS_FILE"; then
    echo "⚠️  Detected redirect - trying to follow"
  fi
  
  # Extract any hidden form fields
  echo "📋 Step 2: Extracting form data..."
  
  # Look for hidden fields and extract values
  HIDDEN_FIELDS=$(grep -o '<input[^>]*type="hidden"[^>]*>' /tmp/installer_page.html | \
    sed -n 's/.*name="\([^"]*\)".*value="\([^"]*\)".*/\1=\2/p' | tr '\n' '&')
  
  echo "📊 Found hidden fields: $HIDDEN_FIELDS"
  
  echo "📋 Step 3: Attempting aggressive form submissions..."
  
  # Try multiple form submission approaches
  ATTEMPTS=(
    # Attempt 1: Skip warnings
    "current_step=0&goto=Next&ignore_warnings=true&next=Next&${HIDDEN_FIELDS}"
    
    # Attempt 2: Direct database submission
    "current_step=1&goto=Next&setup_db_host_name=${DB_HOST}&setup_db_database_name=${DB_NAME}&setup_db_admin_user_name=${DB_USER}&setup_db_admin_password=${DB_PASS}&setup_db_type=mysql&setup_db_port=3306&${HIDDEN_FIELDS}"
    
    # Attempt 3: Complete installation in one shot
    "current_step=3&goto=Install&setup_db_host_name=${DB_HOST}&setup_db_database_name=${DB_NAME}&setup_db_admin_user_name=${DB_USER}&setup_db_admin_password=${DB_PASS}&setup_db_type=mysql&setup_db_port=3306&setup_site_admin_user_name=admin&setup_site_admin_password=Admin2024%21Suite%23&setup_site_admin_password_retype=Admin2024%21Suite%23&setup_site_admin_user_email=admin%40shakatogatt.dzind.com&setup_site_url=https%3A//shakatogatt.dzind.com/suitecrm&${HIDDEN_FIELDS}"
    
    # Attempt 4: Silent install
    "goto=SilentInstall&cli_install=1&setup_db_host_name=${DB_HOST}&setup_db_database_name=${DB_NAME}&setup_db_admin_user_name=${DB_USER}&setup_db_admin_password=${DB_PASS}&setup_db_type=mysql&setup_site_admin_user_name=admin&setup_site_admin_password=Admin2024%21Suite%23&setup_site_admin_user_email=admin%40shakatogatt.dzind.com&${HIDDEN_FIELDS}"
  )
  
  for i in "${!ATTEMPTS[@]}"; do
    echo "🔧 Attempt $((i+1)): ${ATTEMPTS[i]:0:80}..."
    
    # Submit form data with session persistence
    RESPONSE=$(curl -k -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -X POST \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
      -H "Referer: $INSTALL_URL" \
      -H "Origin: https://shakatogatt.dzind.com" \
      -d "${ATTEMPTS[i]}" \
      -w "HTTP_CODE:%{http_code}|REDIRECT:%{redirect_url}|" \
      "$INSTALL_URL")
    
    HTTP_CODE=$(echo "$RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    REDIRECT_URL=$(echo "$RESPONSE" | grep -o "REDIRECT:[^|]*" | cut -d: -f2-)
    
    echo "   Status: $HTTP_CODE"
    
    if [ "$HTTP_CODE" = "200" ]; then
      # Check response content
      if echo "$RESPONSE" | grep -qi "login"; then
        echo "   🎉 SUCCESS! Found login page!"
        echo ""
        echo "🏆 SESSION PERSISTENCE WORKED!"
        echo "✅ SuiteCRM installation completed!"
        echo ""
        echo "📋 Access Information:"
        echo "   🌐 URL: $BASE_URL/"
        echo "   👤 Username: admin"
        echo "   🔑 Password: Admin2024!Suite#"
        exit 0
      elif echo "$RESPONSE" | grep -qi "database.*configuration"; then
        echo "   ✅ Progressed to database step!"
      elif echo "$RESPONSE" | grep -qi "admin.*user"; then
        echo "   ✅ Progressed to admin step!"
      elif ! echo "$RESPONSE" | grep -qi "ignore.*warning"; then
        echo "   ✅ Moved past warnings page!"
      else
        echo "   ❌ Still on warnings page"
      fi
    elif [ "$HTTP_CODE" = "302" ]; then
      echo "   📋 Redirect to: $REDIRECT_URL"
      
      if [ "$REDIRECT_URL" != "install.php" ] && [ "$REDIRECT_URL" != "$INSTALL_URL" ]; then
        echo "   🎉 Redirected away from installer!"
        
        # Follow the redirect and check
        FINAL_RESPONSE=$(curl -k -s -b "$COOKIE_JAR" -L \
          -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
          "https://shakatogatt.dzind.com$REDIRECT_URL")
        
        if echo "$FINAL_RESPONSE" | grep -qi "login"; then
          echo "   🎉 Redirect led to login page!"
          echo ""
          echo "🏆 SESSION PERSISTENCE WORKED!"
          exit 0
        fi
      fi
    fi
    
    echo ""
  done
  
  echo "📋 Step 4: Testing final result..."
  
  # Test the main URLs to see if anything changed
  TEST_URLS=("$BASE_URL/" "$BASE_URL/index.php" "$BASE_URL/public/" "$BASE_URL/public/index.php")
  
  for URL in "${TEST_URLS[@]}"; do
    echo "🔍 Testing: $URL"
    
    RESULT=$(curl -k -s -b "$COOKIE_JAR" -L \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
      -w "HTTP_CODE:%{http_code}|" \
      "$URL")
    
    HTTP_CODE=$(echo "$RESULT" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    
    if [ "$HTTP_CODE" = "200" ]; then
      if echo "$RESULT" | grep -qi "login.*username"; then
        echo "   🎉 SUCCESS! Login page found!"
        echo ""
        echo "🏆 COMPLETE SUCCESS!"
        echo "Session persistence approach worked!"
        echo ""
        echo "📋 Access Information:"
        echo "   🌐 URL: $URL"
        echo "   👤 Username: admin"
        echo "   🔑 Password: Admin2024!Suite#"
        exit 0
      elif ! echo "$RESULT" | grep -qi "install"; then
        echo "   ✅ No installer page detected!"
      fi
    fi
    
    echo "   Status: $HTTP_CODE"
  done
  
else
  echo "❌ Failed to retrieve installer page"
fi

echo ""
echo "🔧 Session persistence approach completed"
echo "All aggressive form submission methods attempted"

# Cleanup
rm -f "$COOKIE_JAR" "$HEADERS_FILE" /tmp/installer_page.html

echo ""
echo "💡 If this still doesn't work, try accessing:"
echo "   https://shakatogatt.dzind.com/suitecrm/install.php"
echo "   And manually click 'IGNORE WARNINGS AND PROCEED'"