#!/bin/bash

# Test Facebook Message Delivery
# This simulates a real Facebook message event to test the complete pipeline

BASE_URL="${1:-https://app.replybase.co.uk}"
WEBHOOK_URL="$BASE_URL/api/facebook/webhook"

echo "🧪 Testing Facebook Message Delivery Pipeline"
echo "Target: $WEBHOOK_URL"
echo ""

# Get the Dreamer page ID from database
echo "📋 Step 1: Fetching Dreamer page configuration..."
echo ""

# Test 1: GET_STARTED Postback (simulates clicking "Get Started" button)
echo "📋 Step 2: Simulating GET_STARTED button click..."
echo ""

POSTBACK_PAYLOAD='{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": '$(date +%s000)',
      "messaging": [
        {
          "sender": {
            "id": "TEST_USER_12345"
          },
          "recipient": {
            "id": "PAGE_ID"
          },
          "timestamp": '$(date +%s000)',
          "postback": {
            "title": "Get Started",
            "payload": "GET_STARTED"
          }
        }
      ]
    }
  ]
}'

echo "Payload:"
echo "$POSTBACK_PAYLOAD" | jq '.'
echo ""

echo "Sending GET_STARTED postback..."
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$POSTBACK_PAYLOAD")

echo "Response: $RESPONSE"
echo ""

# Test 2: Regular text message
echo "📋 Step 3: Simulating text message 'Hello'..."
echo ""

MESSAGE_PAYLOAD='{
  "object": "page",
  "entry": [
    {
      "id": "PAGE_ID",
      "time": '$(date +%s000)',
      "messaging": [
        {
          "sender": {
            "id": "TEST_USER_12345"
          },
          "recipient": {
            "id": "PAGE_ID"
          },
          "timestamp": '$(date +%s000)',
          "message": {
            "mid": "mid.'$(date +%s)'",
            "text": "Hello"
          }
        }
      ]
    }
  ]
}'

echo "Payload:"
echo "$MESSAGE_PAYLOAD" | jq '.'
echo ""

echo "Sending message..."
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$MESSAGE_PAYLOAD")

echo "Response: $RESPONSE"
echo ""

echo "🎉 Tests completed!"
echo ""
echo "📊 Check results:"
echo "  1. Webhook Logs: $BASE_URL/admin/webhook-logs"
echo "  2. Run diagnostic: npm run diagnose:facebook"
echo "  3. Check database:"
echo "     SELECT * FROM webhook_logs ORDER BY \"createdAt\" DESC LIMIT 5;"
echo "     SELECT * FROM flow_sessions ORDER BY \"createdAt\" DESC LIMIT 5;"
echo "     SELECT * FROM crm_messages ORDER BY \"createdAt\" DESC LIMIT 5;"
echo ""
