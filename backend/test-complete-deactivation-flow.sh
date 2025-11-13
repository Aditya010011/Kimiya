#!/bin/bash

echo "🧪 Complete Deactivated Account Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TEST_EMAIL="adityatest2@gmail.com"
TEST_PASSWORD="Test123!"

echo ""
echo "📝 Test 1: Login with wrong password (should show 'Invalid credentials')"
RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword123!\"}")

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword123!\"}")

ERROR=$(echo "$RESPONSE" | jq -r '.error')
MESSAGE=$(echo "$RESPONSE" | jq -r '.message')

echo "  HTTP Status: $HTTP_STATUS"
echo "  Error: $ERROR"
echo "  Message: $MESSAGE"

if [ "$HTTP_STATUS" = "401" ] && [ "$ERROR" = "Invalid credentials" ]; then
  echo "  ✅ Correct response for wrong password"
else
  echo "  ❌ Unexpected response"
fi

echo ""
echo "📝 Test 2: Login with non-existent email (should show 'Invalid credentials')"
RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"Test123!"}')

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"Test123!"}')

ERROR=$(echo "$RESPONSE" | jq -r '.error')
MESSAGE=$(echo "$RESPONSE" | jq -r '.message')

echo "  HTTP Status: $HTTP_STATUS"
echo "  Error: $ERROR"
echo "  Message: $MESSAGE"

if [ "$HTTP_STATUS" = "401" ] && [ "$ERROR" = "Invalid credentials" ]; then
  echo "  ✅ Correct response for non-existent email"
else
  echo "  ❌ Unexpected response"
fi

echo ""
echo "📝 Test 3: Deactivate account and test login"

# Get admin token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kimiyavoice.com","password":"Admin123!"}' | jq -r '.data.tokens.access_token')

# Deactivate user ID 3
curl -s -X PUT http://localhost:3010/api/auth/admin/users/3/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}' > /dev/null

echo "  Account deactivated"

# Try to login with deactivated account
RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

ERROR=$(echo "$RESPONSE" | jq -r '.error')
MESSAGE=$(echo "$RESPONSE" | jq -r '.message')

echo "  HTTP Status: $HTTP_STATUS"
echo "  Error: $ERROR"
echo "  Message: $MESSAGE"

if [ "$HTTP_STATUS" = "403" ] && [ "$ERROR" = "Account deactivated" ]; then
  echo "  ✅ Correct response for deactivated account"
  echo "  ✅ User-friendly message: '$MESSAGE'"
else
  echo "  ❌ Unexpected response"
fi

# Reactivate account (cleanup)
curl -s -X PUT http://localhost:3010/api/auth/admin/users/3/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":true}' > /dev/null

echo "  Account reactivated (cleanup)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All tests completed!"
echo ""
echo "📊 Summary:"
echo "  • Wrong password → HTTP 401 'Invalid credentials'"
echo "  • Non-existent email → HTTP 401 'Invalid credentials'"
echo "  • Deactivated account → HTTP 403 'Account deactivated'"
echo "  • Message shown: 'Your account has been deactivated. Please contact support for assistance.'"
