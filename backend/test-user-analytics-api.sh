#!/bin/bash

echo "🧪 Testing User Analytics API..."
echo ""

# First, login to get a token
echo "1️⃣ Logging in to get auth token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kimiyavoice.com","password":"Admin123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.tokens.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Got auth token: ${TOKEN:0:20}..."
echo ""

# Test user analytics endpoint
echo "2️⃣ Testing /api/user-analytics/1..."
ANALYTICS_RESPONSE=$(curl -s -X GET http://localhost:3010/api/user-analytics/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "$ANALYTICS_RESPONSE" | jq '.'

if echo "$ANALYTICS_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo ""
  echo "✅ User analytics API working!"
  echo ""
  echo "📊 Key Metrics:"
  echo "  Total Calls: $(echo "$ANALYTICS_RESPONSE" | jq -r '.data.twilio_metrics.total_calls_made')"
  echo "  Successful Calls: $(echo "$ANALYTICS_RESPONSE" | jq -r '.data.twilio_metrics.successful_calls')"
  echo "  Total Conversations: $(echo "$ANALYTICS_RESPONSE" | jq -r '.data.conversation_analytics.total_conversations')"
  echo "  Active Workflows: $(echo "$ANALYTICS_RESPONSE" | jq -r '.data.workflow_activity.active_workflows')"
  echo "  Monthly Cost: \$$(echo "$ANALYTICS_RESPONSE" | jq -r '.data.cost_metrics.estimated_monthly_cost')"
else
  echo ""
  echo "❌ User analytics API failed"
fi
