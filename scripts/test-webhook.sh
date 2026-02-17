#!/bin/bash

# Test Facebook Webhook Event Logging
# This simulates Facebook sending events to your webhook

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Testing Facebook Webhook Event Logging"
echo "Target: $BASE_URL/api/facebook/webhook"
echo ""

# Test 1: Verification (GET)
echo "📋 Test 1: Webhook Verification (GET)"
curl -s "$BASE_URL/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=replybase_webhook_verify_2026_secure_token_fb&hub.challenge=test123"
echo -e "\n✅ Verification test complete\n"

# Test 2: Message Event (POST)
echo "📋 Test 2: Message Event (POST)"
curl -X POST "$BASE_URL/api/facebook/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "102032941973750",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "test-user-123"},
        "recipient": {"id": "102032941973750"},
        "timestamp": 1234567890,
        "message": {
          "mid": "test-message-id",
          "text": "Hello from test script!"
        }
      }]
    }]
  }'
echo -e "\n✅ Message event test complete\n"

# Test 3: Postback Event (POST) - GET_STARTED
echo "📋 Test 3: Postback Event (POST) - GET_STARTED"
curl -X POST "$BASE_URL/api/facebook/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "102032941973750",
      "time": 1234567890,
      "messaging": [{
        "sender": {"id": "test-user-456"},
        "recipient": {"id": "102032941973750"},
        "timestamp": 1234567890,
        "postback": {
          "payload": "GET_STARTED",
          "title": "Get Started"
        }
      }]
    }]
  }'
echo -e "\n✅ Postback event test complete\n"

echo "🎉 All tests completed!"
echo ""
echo "📊 Check results at: $BASE_URL/admin/webhook-logs"
echo "Or run: npm run diagnose:facebook"
