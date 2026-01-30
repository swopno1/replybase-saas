#!/bin/bash

# API Integration Test Script
# Tests newsletter and data deletion APIs with API key authentication
#
# Usage: ./test-api-integration.sh [API_URL] [API_KEY]
#
# Example:
#   ./test-api-integration.sh https://app.replybase.co.uk your_api_key_here
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${1:-http://localhost:3000}"
API_KEY="${2}"

if [ -z "$API_KEY" ]; then
  echo -e "${RED}Error: API key is required${NC}"
  echo "Usage: $0 [API_URL] [API_KEY]"
  echo "Example: $0 https://app.replybase.co.uk abc123..."
  exit 1
fi

TEST_EMAIL="test-$(date +%s)@example.com"

echo -e "${YELLOW}=== ReplyBase API Integration Test ===${NC}"
echo "API URL: $API_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Test 1: Newsletter Subscribe
echo -e "${YELLOW}Test 1: Newsletter Subscribe${NC}"
SUBSCRIBE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/newsletter/subscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE=$(echo "$SUBSCRIBE_RESPONSE" | tail -n1)
BODY=$(echo "$SUBSCRIBE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Subscribe successful (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
  
  # Extract unsubscribe token from response
  UNSUBSCRIBE_URL=$(echo "$BODY" | grep -o '"unsubscribeUrl":"[^"]*"' | cut -d'"' -f4)
  echo "Unsubscribe URL: $UNSUBSCRIBE_URL"
else
  echo -e "${RED}✗ Subscribe failed (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
  exit 1
fi
echo ""

# Test 2: Newsletter Subscribe (duplicate - should update)
echo -e "${YELLOW}Test 2: Newsletter Subscribe (duplicate)${NC}"
SUBSCRIBE2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/newsletter/subscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE2=$(echo "$SUBSCRIBE2_RESPONSE" | tail -n1)
BODY2=$(echo "$SUBSCRIBE2_RESPONSE" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
  echo -e "${GREEN}✓ Duplicate subscribe handled correctly (HTTP $HTTP_CODE2)${NC}"
  echo "Response: $BODY2"
else
  echo -e "${RED}✗ Duplicate subscribe failed (HTTP $HTTP_CODE2)${NC}"
  echo "Response: $BODY2"
  exit 1
fi
echo ""

# Test 3: Newsletter Unsubscribe
echo -e "${YELLOW}Test 3: Newsletter Unsubscribe${NC}"
UNSUBSCRIBE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/newsletter/unsubscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE3=$(echo "$UNSUBSCRIBE_RESPONSE" | tail -n1)
BODY3=$(echo "$UNSUBSCRIBE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE3" = "200" ]; then
  echo -e "${GREEN}✓ Unsubscribe successful (HTTP $HTTP_CODE3)${NC}"
  echo "Response: $BODY3"
else
  echo -e "${RED}✗ Unsubscribe failed (HTTP $HTTP_CODE3)${NC}"
  echo "Response: $BODY3"
  exit 1
fi
echo ""

# Test 4: Data Deletion Request
echo -e "${YELLOW}Test 4: Data Deletion Request${NC}"
DELETION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/data-deletion/request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE4=$(echo "$DELETION_RESPONSE" | tail -n1)
BODY4=$(echo "$DELETION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE4" = "200" ]; then
  echo -e "${GREEN}✓ Data deletion request successful (HTTP $HTTP_CODE4)${NC}"
  echo "Response: $BODY4"
  
  # Extract confirmation code
  CONFIRMATION_CODE=$(echo "$BODY4" | grep -o '"confirmationCode":"[^"]*"' | cut -d'"' -f4)
  echo "Confirmation Code: $CONFIRMATION_CODE"
else
  echo -e "${RED}✗ Data deletion request failed (HTTP $HTTP_CODE4)${NC}"
  echo "Response: $BODY4"
  exit 1
fi
echo ""

# Test 5: Data Deletion Status (public endpoint, no auth)
if [ -n "$CONFIRMATION_CODE" ]; then
  echo -e "${YELLOW}Test 5: Data Deletion Status (public)${NC}"
  STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/data-deletion/status?code=$CONFIRMATION_CODE")
  
  HTTP_CODE5=$(echo "$STATUS_RESPONSE" | tail -n1)
  BODY5=$(echo "$STATUS_RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE5" = "200" ]; then
    echo -e "${GREEN}✓ Status check successful (HTTP $HTTP_CODE5)${NC}"
    echo "Response: $BODY5"
  else
    echo -e "${RED}✗ Status check failed (HTTP $HTTP_CODE5)${NC}"
    echo "Response: $BODY5"
    exit 1
  fi
  echo ""
fi

# Test 6: Invalid API Key (should fail with 401)
echo -e "${YELLOW}Test 6: Invalid API Key (should fail)${NC}"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/newsletter/subscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_key_12345" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE6=$(echo "$INVALID_RESPONSE" | tail -n1)
BODY6=$(echo "$INVALID_RESPONSE" | sed '$d')

if [ "$HTTP_CODE6" = "401" ]; then
  echo -e "${GREEN}✓ Invalid key rejected correctly (HTTP $HTTP_CODE6)${NC}"
  echo "Response: $BODY6"
else
  echo -e "${RED}✗ Invalid key not rejected (HTTP $HTTP_CODE6)${NC}"
  echo "Response: $BODY6"
  exit 1
fi
echo ""

# Test 7: Missing API Key (should fail with 401)
echo -e "${YELLOW}Test 7: Missing API Key (should fail)${NC}"
MISSING_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/newsletter/subscribe" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

HTTP_CODE7=$(echo "$MISSING_RESPONSE" | tail -n1)
BODY7=$(echo "$MISSING_RESPONSE" | sed '$d')

if [ "$HTTP_CODE7" = "401" ]; then
  echo -e "${GREEN}✓ Missing key rejected correctly (HTTP $HTTP_CODE7)${NC}"
  echo "Response: $BODY7"
else
  echo -e "${RED}✗ Missing key not rejected (HTTP $HTTP_CODE7)${NC}"
  echo "Response: $BODY7"
  exit 1
fi
echo ""

# Summary
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}✓ All tests passed successfully!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Test Summary:"
echo "  ✓ Newsletter subscribe"
echo "  ✓ Duplicate subscription handling"
echo "  ✓ Newsletter unsubscribe"
echo "  ✓ Data deletion request"
echo "  ✓ Deletion status check"
echo "  ✓ Invalid API key rejection"
echo "  ✓ Missing API key rejection"
echo ""
echo -e "${YELLOW}Note: This test created the following test data:${NC}"
echo "  Email: $TEST_EMAIL"
echo "  Status: Unsubscribed from newsletter"
echo "  Data Deletion Request: $CONFIRMATION_CODE"
echo ""
echo "Marketing site integration is ready for production! 🚀"
