#!/bin/bash

echo "🧪 Testing Deactivated Account Login Flow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test user credentials
TEST_EMAIL="adityatest1@gmail.com"
TEST_PASSWORD="Test123!"

echo ""
echo "📝 Step 1: Test login with active account"
echo "Testing login for: $TEST_EMAIL"
RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✅ Login successful with active account"
else
  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
  echo "❌ Login failed: $ERROR - $MESSAGE"
fi

echo ""
echo "📝 Step 2: Deactivate the test account"
# Get admin token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kimiyavoice.com","password":"Admin123!"}' | jq -r '.data.tokens.access_token')

# Deactivate user ID 2
curl -s -X PUT http://localhost:3010/api/auth/admin/users/2/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}' > /dev/null

echo "✅ Account deactivated"

echo ""
echo "📝 Step 3: Test login with deactivated account"
RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
ERROR=$(echo "$RESPONSE" | jq -r '.error')
MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "HTTP Status: $HTTP_STATUS"
echo "Success: $SUCCESS"
echo "Error: $ERROR"
echo "Message: $MESSAGE"

if [ "$ERROR" = "Account deactivated" ]; then
  echo "✅ Correct error message shown for deactivated account!"
else
  echo "❌ Wrong error message. Expected 'Account deactivated', got '$ERROR'"
fi

echo ""
echo "📝 Step 4: Reactivate the test account (cleanup)"
curl -s -X PUT http://localhost:3010/api/auth/admin/users/2/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":true}' > /dev/null

echo "✅ Account reactivated (cleanup complete)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Test completed!"
