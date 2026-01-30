#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🌱 ReplyBase Database Seeding${NC}"
echo "================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

echo -e "${YELLOW}1️⃣  Seeding Stripe Plans...${NC}"
npx tsx scripts/seed-stripe.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Stripe seeding failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Stripe plans seeded${NC}"

echo ""
echo -e "${YELLOW}2️⃣  Seeding Demo Templates...${NC}"
npx tsx scripts/seed-demo-templates.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Demo templates seeding failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Demo templates seeded${NC}"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ All seeds completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"
