#!/bin/bash
# API Coverage Tracking Script for 20i MCP Server
# This script counts all API endpoints and implemented tools

echo "=== 20i MCP Server API Coverage Analysis ==="
echo ""

# Count official API endpoints
echo "Official 20i API Documentation Analysis:"
echo "----------------------------------------"
GET_COUNT=$(grep -c "^### .* \[GET\]" archive/gitignor_ref_folder/20i_api_doc.apib)
POST_COUNT=$(grep -c "^### .* \[POST\]" archive/gitignor_ref_folder/20i_api_doc.apib)
PUT_COUNT=$(grep -c "^### .* \[PUT\]" archive/gitignor_ref_folder/20i_api_doc.apib)
DELETE_COUNT=$(grep -c "^### .* \[DELETE\]" archive/gitignor_ref_folder/20i_api_doc.apib)
PATCH_COUNT=$(grep -c "^### .* \[PATCH\]" archive/gitignor_ref_folder/20i_api_doc.apib)
TOTAL_ENDPOINTS=$(grep -c "^### .* \[GET\|POST\|PUT\|DELETE\|PATCH\]" archive/gitignor_ref_folder/20i_api_doc.apib)

echo "GET endpoints: $GET_COUNT"
echo "POST endpoints: $POST_COUNT"
echo "PUT endpoints: $PUT_COUNT"
echo "DELETE endpoints: $DELETE_COUNT"
echo "PATCH endpoints: $PATCH_COUNT"
echo "TOTAL API endpoints: $TOTAL_ENDPOINTS"
echo ""

# Count implemented tools
echo "Implemented MCP Tools Analysis:"
echo "-------------------------------"
# Extract tool names from tools array
sed -n '/tools: \[/,$ p' src/index.ts | grep "name: '" | sed "s/.*name: '//" | sed "s/'.*//" | sort > /tmp/tool_names.txt
# Extract case handler names
grep "case '" src/index.ts | sed "s/.*case '//" | sed "s/':.*$//" | sort > /tmp/case_names.txt
# Get unique tools
cat /tmp/tool_names.txt /tmp/case_names.txt | sort -u > /tmp/unique_tools.txt

TOOLS_IN_ARRAY=$(wc -l < /tmp/tool_names.txt | tr -d ' ')
CASE_HANDLERS=$(wc -l < /tmp/case_names.txt | tr -d ' ')
UNIQUE_TOOLS=$(wc -l < /tmp/unique_tools.txt | tr -d ' ')

echo "Tools in MCP array: $TOOLS_IN_ARRAY"
echo "Case handlers: $CASE_HANDLERS"
echo "Total unique tools: $UNIQUE_TOOLS"
echo ""

# Calculate coverage
echo "API Coverage Calculation:"
echo "------------------------"
COVERAGE=$(echo "scale=1; $UNIQUE_TOOLS/$TOTAL_ENDPOINTS*100" | bc)
echo "Coverage: $UNIQUE_TOOLS / $TOTAL_ENDPOINTS = $COVERAGE%"
echo ""

# Show API groups
echo "API Groups:"
echo "-----------"
grep "^# Group" archive/gitignor_ref_folder/20i_api_doc.apib | sed 's/# Group //'
echo ""

# Clean up temp files
rm -f /tmp/tool_names.txt /tmp/case_names.txt /tmp/unique_tools.txt

echo "=== Analysis Complete ==="