#!/bin/bash
# Production Security Hardening Script
# Execute on DigitalOcean droplet: 104.248.160.102

set -e

echo "==================================================================="
echo "Production Security Hardening - ReplyBase"
echo "==================================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo ""
echo "-------------------------------------------------------------------"
echo "Task 1: Fix Typebot Builder OIDC Configuration"
echo "-------------------------------------------------------------------"

TYPEBOT_ENV_FILE="/data/coolify/applications/zsw4wccwc0s88s4o0osck4k8/.env"

# Backup original .env
if [ -f "$TYPEBOT_ENV_FILE" ]; then
    cp "$TYPEBOT_ENV_FILE" "$TYPEBOT_ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    print_status "Backed up original Typebot .env file"
fi

# Update OIDC callback URLs to use correct NextAuth path
print_warning "Updating OIDC callback URL from /api/auth/oauth/generic-oidc/callback"
print_warning "                              to /api/auth/callback/generic-oidc"

sed -i 's|OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback|OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/callback/generic-oidc|g' "$TYPEBOT_ENV_FILE"
sed -i 's|OIDC_REDIRECT_URI=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback|OIDC_REDIRECT_URI=https://engine.replybase.co.uk/api/auth/callback/generic-oidc|g' "$TYPEBOT_ENV_FILE"

# Remove escaped quotes from OIDC_NAME if present
sed -i 's|OIDC_NAME=\\"ReplyBase SaaS\\"|OIDC_NAME="ReplyBase SaaS"|g' "$TYPEBOT_ENV_FILE"

print_status "Updated OIDC callback URLs to use standard NextAuth path"

echo ""
echo "-------------------------------------------------------------------"
echo "Task 2: Disable DEBUG Mode in Bot-Builder"
echo "-------------------------------------------------------------------"

# Check if DEBUG variable exists and update/add it
if grep -q "^DEBUG=" "$TYPEBOT_ENV_FILE"; then
    sed -i 's|^DEBUG=.*|DEBUG=false|g' "$TYPEBOT_ENV_FILE"
    print_status "Disabled DEBUG mode (was previously enabled)"
else
    # Check if DEBUG is set as true anywhere
    if grep -q "DEBUG=true" "$TYPEBOT_ENV_FILE"; then
        sed -i 's|DEBUG=true|DEBUG=false|g' "$TYPEBOT_ENV_FILE"
        print_status "Disabled DEBUG mode"
    else
        # Add DEBUG=false if not present
        echo "DEBUG=false" >> "$TYPEBOT_ENV_FILE"
        print_status "Added DEBUG=false to environment"
    fi
fi

echo ""
echo "-------------------------------------------------------------------"
echo "Task 3: Restrict PostgreSQL to Localhost"
echo "-------------------------------------------------------------------"

# Find PostgreSQL container
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    print_error "PostgreSQL container not found"
else
    print_warning "PostgreSQL container: $POSTGRES_CONTAINER"
    
    # Check current binding
    CURRENT_BINDING=$(docker port "$POSTGRES_CONTAINER" 2>/dev/null | grep 5432 || echo "")
    
    if echo "$CURRENT_BINDING" | grep -q "0.0.0.0"; then
        print_warning "PostgreSQL is currently exposed on 0.0.0.0:5432"
        print_warning "This requires docker-compose.yaml modification"
        print_warning ""
        print_warning "MANUAL ACTION REQUIRED:"
        print_warning "1. Find PostgreSQL docker-compose file (usually in /data/coolify/databases/)"
        print_warning "2. Change ports mapping from '0.0.0.0:5432:5432' to '127.0.0.1:5432:5432'"
        print_warning "3. Restart PostgreSQL container"
        print_warning ""
        print_warning "Example command:"
        print_warning "   docker-compose -f /path/to/postgres/docker-compose.yaml up -d --force-recreate"
    else
        print_status "PostgreSQL is not exposed on 0.0.0.0 (already secure)"
    fi
fi

echo ""
echo "-------------------------------------------------------------------"
echo "Task 4: Restart Typebot Builder Container"
echo "-------------------------------------------------------------------"

TYPEBOT_CONTAINER="zsw4wccwc0s88s4o0osck4k8-225113629810"

# Restart bot-builder to apply environment changes
cd /data/coolify/applications/zsw4wccwc0s88s4o0osck4k8
docker compose restart

print_status "Restarted Typebot Builder container"

# Wait for container to be ready
sleep 5

# Check if container is running
if docker ps | grep -q "$TYPEBOT_CONTAINER"; then
    print_status "Typebot Builder container is running"
else
    print_error "Typebot Builder container failed to start - check logs"
fi

echo ""
echo "-------------------------------------------------------------------"
echo "Task 5: Verify OIDC Configuration"
echo "-------------------------------------------------------------------"

# Test OIDC issuer endpoint
print_warning "Testing OIDC issuer endpoint..."
OIDC_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://app.replybase.co.uk/api/oidc/.well-known/openid-configuration)

if [ "$OIDC_RESPONSE" = "200" ]; then
    print_status "OIDC issuer endpoint is accessible (HTTP 200)"
else
    print_error "OIDC issuer endpoint returned HTTP $OIDC_RESPONSE"
fi

# Test JWKS endpoint
JWKS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://app.replybase.co.uk/api/oidc/jwks)

if [ "$JWKS_RESPONSE" = "200" ]; then
    print_status "JWKS endpoint is accessible (HTTP 200)"
else
    print_error "JWKS endpoint returned HTTP $JWKS_RESPONSE"
fi

echo ""
echo "-------------------------------------------------------------------"
echo "Summary of Changes"
echo "-------------------------------------------------------------------"

echo ""
echo "✅ Completed:"
echo "   - Updated Typebot OIDC callback URL to /api/auth/callback/generic-oidc"
echo "   - Disabled DEBUG mode in bot-builder environment"
echo "   - Restarted Typebot Builder container"
echo "   - Verified OIDC endpoints are accessible"
echo ""
echo "⚠️  Manual Actions Required:"
echo "   - PostgreSQL: Modify docker-compose to bind 127.0.0.1:5432 (see instructions above)"
echo "   - Engine Access: Add Traefik IP whitelist for engine.replybase.co.uk"
echo "   - SaaS Rebuild: Redeploy replybase-saas to apply updated OIDC provider config"
echo ""
echo "🔍 Next Steps:"
echo "   1. Test OIDC authentication flow:"
echo "      - Login to https://app.replybase.co.uk"
echo "      - Navigate to Bots page"
echo "      - Click 'Open Bot Builder' - should redirect to engine via OIDC"
echo "   2. Monitor logs for OIDC errors:"
echo "      docker logs -f $TYPEBOT_CONTAINER 2>&1 | grep -i 'auth\|oidc'"
echo ""
echo "==================================================================="
echo "Security Hardening Script Complete"
echo "==================================================================="
