# 🚀 Production Deployment Plan

**Objective**: Deploy ReplyBase SaaS MVP to production with Typebot Builder/Viewer integration  
**Timeline**: 7-10 days  
**Environment**: Digital Ocean + Coolify

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Phase 1: Environment Configuration](#phase-1-environment-configuration)
3. [Phase 2: Database Setup](#phase-2-database-setup)
4. [Phase 3: Typebot Configuration](#phase-3-typebot-configuration)
5. [Phase 4: Infrastructure Security](#phase-4-infrastructure-security)
6. [Phase 5: Testing & Validation](#phase-5-testing--validation)
7. [Phase 6: Go Live](#phase-6-go-live)
8. [Post-Deployment](#post-deployment)
9. [Rollback Plan](#rollback-plan)

---

## Pre-Deployment Checklist

### Access Verification

- [ ] SSH access to Digital Ocean: `ssh root@104.248.160.102`
- [ ] Coolify dashboard access
- [ ] Database access confirmed
- [ ] Domain DNS configured:
  - [ ] `app.replybase.co.uk` → SaaS App
  - [ ] `engine.replybase.co.uk` → Typebot Builder
  - [ ] `bot.investorhints.com` → Typebot Viewer
- [ ] SSL certificates active for all domains

### External Services

- [ ] Google OAuth app created
- [ ] Facebook OAuth app created
- [ ] Stripe account configured
- [ ] Stripe webhook endpoints set up

### Backup Strategy

- [ ] Database backup mechanism in place
- [ ] Environment variables backed up securely
- [ ] Code repository backed up

---

## Phase 1: Environment Configuration

**Duration**: 2-3 hours  
**Risk**: 🔴 Critical

### Step 1.1: Generate Cryptographic Keys

**On your local machine** (not on server initially):

```bash
cd /Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-saas

# Generate OIDC keys
node scripts/generate-jwks.js > oidc-keys.txt

# Generate AUTH_SECRET
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> oidc-keys.txt

# Generate TYPEBOT_OIDC_CLIENT_SECRET
echo "TYPEBOT_OIDC_CLIENT_SECRET=$(openssl rand -base64 32)" >> oidc-keys.txt

# Review the file
cat oidc-keys.txt
```

**Expected Output**:

```
=== OIDC CONFIGURATION ===

OIDC_COOKIE_KEY=<128-char hex string>
OIDC_JWKS={"keys":[{...}]}

==========================

AUTH_SECRET=<44-char base64 string>
TYPEBOT_OIDC_CLIENT_SECRET=<44-char base64 string>
```

**⚠️ SECURITY**:

- Store `oidc-keys.txt` in a password manager (1Password, LastPass, etc.)
- Never commit to git
- Delete local file after storing: `shred -u oidc-keys.txt` (Linux) or `rm -P oidc-keys.txt` (Mac)

### Step 1.2: Create .env File Template

Create a new file `.env.production` with all required variables:

```bash
# ==============================================
# ReplyBase SaaS - Production Environment
# ==============================================
# Generated: 2026-01-30
# Environment: Digital Ocean + Coolify
# ==============================================

# ----- CORE APPLICATION -----
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.replybase.co.uk

# ----- AUTHENTICATION -----
# Generate with: openssl rand -base64 32
AUTH_SECRET=<FROM_oidc-keys.txt>
NEXTAUTH_URL=https://app.replybase.co.uk

# ----- GOOGLE OAUTH -----
GOOGLE_CLIENT_ID=<FROM_GOOGLE_CONSOLE>
GOOGLE_CLIENT_SECRET=<FROM_GOOGLE_CONSOLE>

# ----- FACEBOOK OAUTH -----
FACEBOOK_CLIENT_ID=<FROM_FACEBOOK_DEVELOPERS>
FACEBOOK_CLIENT_SECRET=<FROM_FACEBOOK_DEVELOPERS>
FACEBOOK_WEBHOOK_VERIFY_TOKEN=<RANDOM_STRING>

# ----- OIDC PROVIDER (Typebot Integration) -----
# Generate with: node scripts/generate-jwks.js
OIDC_JWKS=<FROM_oidc-keys.txt>
OIDC_COOKIE_KEY=<FROM_oidc-keys.txt>

# Typebot Client Configuration
TYPEBOT_OIDC_CLIENT_ID=typebot-engine
TYPEBOT_OIDC_CLIENT_SECRET=<FROM_oidc-keys.txt>
TYPEBOT_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback

# ----- DATABASE -----
# Format: postgresql://user:password@host:5432/dbname?sslmode=require
DATABASE_URL=postgresql://<USER>:<PASSWORD>@<HOST>:5432/<DBNAME>?sslmode=require

# ----- STRIPE -----
STRIPE_SECRET_KEY=sk_live_<FROM_STRIPE>
STRIPE_WEBHOOK_SECRET=whsec_<FROM_STRIPE_WEBHOOKS>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<FROM_STRIPE>

# Stripe Price IDs (set after creating products in Stripe)
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_<STARTER>
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_<PRO>
NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID=price_<BUSINESS>

# ----- OPTIONAL / FUTURE -----
# AI_ENGINE_URL=https://typebot.io
# TYPEBOT_TOKEN=<IF_NEEDED>
# TYPEBOT_DEFAULT_BOT_ID=<FOR_TESTING>
```

### Step 1.3: Configure Environment in Coolify

**Access Coolify**:

1. Navigate to your Coolify dashboard
2. Select the ReplyBase SaaS application
3. Go to "Environment Variables" section

**Add Variables**:

**Option A: Via Coolify UI**

1. Click "Add Variable"
2. Copy each line from `.env.production`
3. For `OIDC_JWKS`, ensure JSON is properly formatted (single line, escaped quotes)

**Option B: Via SSH**

```bash
# SSH into your server
ssh root@104.248.160.102

# Navigate to your application directory
cd /path/to/replybase-saas  # Check with Coolify

# Create .env file
nano .env

# Paste contents from .env.production
# Save: Ctrl+X, Y, Enter
```

**⚠️ IMPORTANT**:

- Ensure `OIDC_JWKS` is on a single line
- Escape any special characters in JSON
- Verify no trailing spaces or newlines

### Step 1.4: Validate Environment Variables

**On the server**:

```bash
# Check if critical vars are set
env | grep -E "(AUTH_SECRET|OIDC_|DATABASE_URL|STRIPE_)"

# Verify OIDC_JWKS is valid JSON
echo $OIDC_JWKS | jq .

# Expected output: Should show formatted JSON with "keys" array
```

**✅ Success Criteria**:

- All 22+ environment variables set
- No errors when parsing OIDC_JWKS as JSON
- Secrets are 32+ characters (not placeholder values)

---

## Phase 2: Database Setup

**Duration**: 1-2 hours  
**Risk**: 🟡 Medium

### Step 2.1: Verify Database Connection

```bash
# SSH into server
ssh root@104.248.160.102

# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Expected: PostgreSQL version info
```

**If connection fails**:

- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check firewall rules
- Verify SSL mode if required

### Step 2.2: Run Prisma Migrations

```bash
# Navigate to app directory
cd /path/to/replybase-saas

# Generate Prisma Client
npx prisma generate

# Apply all migrations
npx prisma migrate deploy

# Expected output:
# "Database is now in sync with your Prisma schema"
```

**Verify Migrations**:

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Expected tables:
# - users
# - accounts
# - sessions
# - tenants
# - subscriptions
# - plans
# - bots
# - oidc_models
# ... and more
```

### Step 2.3: Seed Stripe Plans

**Prerequisites**: `STRIPE_SECRET_KEY` must be set

```bash
# Check if plans already exist
psql $DATABASE_URL -c "SELECT name, price FROM plans;"

# If empty, seed:
npm run seed:stripe
# OR
node -r dotenv/config scripts/seed-stripe.ts
```

**Expected Output**:

```
✓ Seeded plan: Starter (price_xxxxx)
✓ Seeded plan: Pro (price_xxxxx)
✓ Seeded plan: Business (price_xxxxx)
```

**Verify**:

```bash
psql $DATABASE_URL -c "SELECT name, \"displayName\", price, \"maxBots\" FROM plans;"
```

**Expected**:

```
   name    | displayName | price | maxBots
-----------+-------------+-------+---------
 starter   | Starter     |  9.99 |       1
 pro       | Pro         | 29.99 |       5
 business  | Business    | 99.99 |      20
```

### Step 2.4: Update Stripe Price IDs

**After seeding** (if script doesn't output price IDs):

1. Go to Stripe Dashboard → Products
2. Find each plan's Price ID
3. Update `.env`:

```bash
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID=price_xxxxx
```

4. Restart application in Coolify

**✅ Success Criteria**:

- Database migrations applied
- All tables created
- 3 Stripe plans seeded
- Price IDs configured

---

## Phase 3: Typebot Configuration

**Duration**: 4-6 hours  
**Risk**: 🔴 Critical  
**Complexity**: High (External system)

### Step 3.1: Access Typebot Engine

**Current State Assessment**:

```bash
# Test if Typebot Engine is running
curl -I https://engine.replybase.co.uk

# Expected: 200 OK (if accessible)
# If 404/502: Typebot not deployed
# If 403: Already restricted (good!)
```

**Document Current Config**:

1. Screenshot current Typebot settings
2. Note which auth providers are enabled
3. Check if OIDC is already configured
4. Backup any existing configuration

### Step 3.2: Disable Public Authentication

**Goal**: Remove all direct login methods from Typebot Engine

**In Typebot Settings** (usually at `https://engine.replybase.co.uk/settings`):

#### Disable Google OAuth

```env
# In Typebot's .env file:
DISABLE_GOOGLE_AUTH=true
```

**OR** in Typebot Settings UI:

1. Navigate to Settings → Authentication
2. Disable "Google" provider
3. Save changes

#### Disable Facebook OAuth

```env
DISABLE_FACEBOOK_AUTH=true
```

**OR** disable in UI

#### Disable Email/Password

```env
DISABLE_EMAIL_AUTH=true
```

**OR** disable in UI

**⚠️ WARNING**: Do this ONLY after OIDC is working, or you'll lock yourself out!

### Step 3.3: Configure OIDC Provider

**In Typebot Engine Environment**:

```env
# OIDC Configuration
OIDC_ISSUER=https://app.replybase.co.uk/api/oidc
OIDC_CLIENT_ID=typebot-engine
OIDC_CLIENT_SECRET=<SAME_AS_TYPEBOT_OIDC_CLIENT_SECRET_IN_SAAS_ENV>
OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback
OIDC_SCOPE=openid email profile plan subscription_status
```

**In Typebot UI** (if applicable):

1. Go to Settings → Authentication
2. Enable "Generic OIDC" or "Custom OIDC" provider
3. Fill in:
   - **Issuer URL**: `https://app.replybase.co.uk/api/oidc`
   - **Client ID**: `typebot-engine`
   - **Client Secret**: `<FROM_oidc-keys.txt>`
   - **Callback URL**: `https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback`
   - **Scopes**: `openid email profile plan subscription_status`
4. Save configuration

**Restart Typebot Engine**:

```bash
# In Coolify or Docker
docker restart typebot-engine
# OR via Coolify UI: Stop → Start
```

### Step 3.4: Implement Token Validation Middleware

**⚠️ CRITICAL**: This step requires code changes to Typebot Engine (if you have access)

**If Typebot is self-hosted and you can modify it**:

Create middleware file (Typebot-specific path):

```typescript
// typebot-engine/middleware/oidc-validator.ts
import { verifyJWT, createRemoteJWKSet } from "jose";

const JWKS_URL = "https://app.replybase.co.uk/api/oidc/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export async function validateOIDCToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "") || req.session?.accessToken;

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid OIDC token required. Access through app.replybase.co.uk",
    });
  }

  try {
    const { payload } = await verifyJWT(token, JWKS, {
      issuer: "https://app.replybase.co.uk/api/oidc",
      audience: "typebot-engine",
    });

    // CRITICAL: Validate subscription
    if (
      payload.subscription_status !== "active" &&
      payload.subscription_status !== "trialing"
    ) {
      return res.status(403).json({
        error: "Subscription required",
        message: "Active subscription required to access builder",
      });
    }

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid token",
      message: "Token validation failed",
    });
  }
}
```

Apply to routes (Typebot-specific):

```typescript
// Apply to all builder routes
app.use("/builder", validateOIDCToken);
app.use("/api/bots", validateOIDCToken);
app.use("/api/workspaces", validateOIDCToken);
```

**If Typebot is a third-party service**:

- Check Typebot documentation for OIDC middleware support
- Contact Typebot support for integration guidance
- May need to use Typebot's built-in OIDC features only

### Step 3.5: Test OIDC Flow (Initial)

**From your browser**:

1. Go to `https://app.replybase.co.uk`
2. Log in with test account
3. Navigate to Bots page
4. Click "Launch Builder" button
5. **Expected**: Redirect to OIDC authorization
6. **Expected**: Redirect to Typebot Engine
7. **Expected**: Auto-login to Typebot

**Debugging**:

```bash
# Check SaaS app logs
docker logs -f replybase-saas

# Check Typebot Engine logs
docker logs -f typebot-engine

# Look for OIDC-related errors
```

**Common Issues**:

- **"Invalid client"**: `TYPEBOT_OIDC_CLIENT_ID` mismatch
- **"Invalid redirect_uri"**: `TYPEBOT_CALLBACK_URL` mismatch
- **"JWKS error"**: `OIDC_JWKS` not valid JSON
- **"Unauthorized"**: Token validation failing

**✅ Success Criteria**:

- Public auth disabled on Typebot
- OIDC provider configured
- Initial test flow completes without errors

---

## Phase 4: Application-Level Security ⭐ UPDATED

**Duration**: 1-2 hours  
**Risk**: 🟢 Low (Application-level, no infrastructure changes needed)

### Important Note: Nginx Configuration Not Available

Since your Coolify setup does not allow Nginx modification, security is enforced at the **application level** instead. This is a standard approach for modern SaaS platforms.

### Step 4.1: Verify Typebot Engine OIDC Configuration

**Goal**: Ensure Typebot validates all access via OIDC tokens

**In Typebot Engine Settings**:

1. Verify OIDC provider is configured (from Phase 3)
2. Confirm public authentication is DISABLED:
   - [ ] Google OAuth disabled
   - [ ] Facebook OAuth disabled
   - [ ] Email/Password disabled
3. Verify token validation is active in Typebot logs

**Check Logs**:

```bash
docker logs -f typebot-engine | grep -i "oidc\|token\|auth"

# Expected output includes:
# - OIDC provider initialized
# - Token validation successful
# - Subscription status checks
```

**Security Enforcement**:

- OIDC tokens must include `subscription_status: active`
- Typebot validates tokens before granting builder access
- Only authenticated users with active subscriptions can create/edit bots
- Token validation happens at application layer

### Step 4.2: Verify Typebot Viewer Configuration

**Goal**: Ensure viewer only provides public bot access

**In Typebot Viewer Settings** (if applicable):

1. Confirm viewer is separate from builder (different domain)
2. Verify admin routes are restricted (if Typebot supports this)
3. Test that public bots are accessible
4. Test that builder/settings are NOT accessible via viewer

**Test Access**:

```bash
# Public bot viewing (should work)
curl -I https://bot.investorhints.com/

# Admin endpoints (should return 404 or 403)
curl -I https://bot.investorhints.com/builder
curl -I https://bot.investorhints.com/settings
curl -I https://bot.investorhints.com/api/bots

# Expected: 403 or 404 on admin routes
```

```nginx
# ============================================
# Typebot Viewer - Admin Route Blocking
# ============================================

# Block admin/builder routes
location ~ ^/(builder|settings|analytics|admin|api/bots|api/workspaces|api/users) {
    return 403 "Admin routes are not accessible on the viewer domain. Use engine.replybase.co.uk";
}

# Allow public bot viewing
location / {
    proxy_pass http://localhost:3001;  # Adjust port if different
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Step 4.3: Verify Security is Working

**Test OIDC Token Validation**:

```bash
# 1. Log in to SaaS app
# 2. Click "Launch Builder"
# 3. Check browser DevTools → Network for OIDC flow
# 4. Decode the JWT token to verify claims

# Token should contain:
# {
#   "sub": "user_id",
#   "email": "user@example.com",
#   "plan": "starter",
#   "subscription_status": "active",  ← CRITICAL
#   "iss": "https://app.replybase.co.uk/api/oidc",
#   "aud": "typebot-engine"
# }
```

**Test Viewer Public Access**:

```bash
# Public bot viewing (should work)
curl -I https://bot.investorhints.com/

# Expected: HTTP/1.1 200 OK
```

**Monitor Typebot Engine Logs**:

```bash
# Watch for authentication events
docker logs -f typebot-engine | grep -iE "oidc|token|auth|subscription"

# Expected to see:
# - OIDC tokens being validated
# - Subscription status checks
# - Successful authentications
# - No auth errors for valid tokens
```

### Step 4.4: Security Summary

**What's Protected**:

- ✅ Only authenticated users can access builder
- ✅ Only users with active subscriptions get tokens
- ✅ Public auth methods disabled on Engine
- ✅ OIDC token includes required claims

**What's Open**:

- ⚠️ Public can see the Typebot URLs (not hidden at infrastructure level)
- ⚠️ But accessing them requires valid OIDC token
- ⚠️ This is standard for SaaS (app-level security, not network-level)

**Why This is Secure**:

- OIDC token validation is cryptographically strong
- Subscription status is verified before tokens issued
- Tokens expire after short period (default: 1 hour)
- Token signing keys are secure (stored in OIDC_JWKS)

**✅ Success Criteria**:

- Unauthenticated users cannot access builder
- Users with inactive subscriptions cannot access builder
- Users with active subscriptions get auto-logged in
- OIDC tokens are valid and contain required claims
- Typebot logs show token validation happening

---

## Phase 5: Testing & Validation

**Duration**: 1-2 days  
**Risk**: 🟡 Medium

### Step 5.1: End-to-End User Flow Test

**Test Scenario 1: New User Registration → Subscription → Bot Access**

1. **Register New User**:

   ```
   - Go to https://app.replybase.co.uk/auth/register
   - Register with test email
   - Expected: Redirect to dashboard
   - Expected: Tenant created automatically
   ```

2. **Subscribe to Plan**:

   ```
   - Click "Upgrade" or go to /pricing
   - Select "Starter" plan
   - Complete Stripe checkout (use test card: 4242 4242 4242 4242)
   - Expected: Redirect back to app
   - Expected: Subscription status = "active"
   ```

3. **Access Bot Builder**:
   ```
   - Go to /bots
   - Click "Launch Builder"
   - Expected: OIDC flow initiates
   - Expected: Redirect to Typebot Engine
   - Expected: Auto-login to Typebot
   - Expected: Can create/edit bots
   ```

**Test Scenario 2: Existing User with Active Subscription**

1. Log in to SaaS app
2. Verify subscription status shows "Active"
3. Click "Launch Builder"
4. Verify seamless redirect to Typebot
5. Create a test bot
6. Verify bot appears in SaaS app bot list

**Test Scenario 3: Subscription Expiry**

1. **Manually expire subscription** (in database or Stripe):

   ```sql
   UPDATE subscriptions
   SET status = 'canceled'
   WHERE "tenantId" = '<test_tenant_id>';
   ```

2. Log out and log back in (to refresh session)
3. Try to access builder
4. **Expected**: Redirect to /pricing with error message
5. **Expected**: Cannot access Typebot

6. **Restore subscription**:
   ```sql
   UPDATE subscriptions
   SET status = 'active'
   WHERE "tenantId" = '<test_tenant_id>';
   ```

### Step 5.2: Security Testing

**Test 1: Direct Engine Access (should fail)**

```bash
# From browser (incognito mode)
# Go to: https://engine.replybase.co.uk

# Expected: 403 Forbidden
# Expected: Message about accessing through SaaS app
```

**Test 2: Expired Token**

```bash
# Use an old/expired token
TOKEN="<expired_or_fake_token>"

curl -H "Authorization: Bearer $TOKEN" \
  https://engine.replybase.co.uk/api/bots

# Expected: 401 Unauthorized
# Expected: Error about invalid token
```

**Test 3: Token Without Subscription**

```bash
# This requires creating a user with inactive subscription
# Then getting their OIDC token and trying to access Engine

# Expected: 403 Forbidden
# Expected: Message about subscription required
```

**Test 4: Viewer Admin Access (should fail)**

```bash
# In browser
# Go to: https://bot.investorhints.com/builder

# Expected: 403 Forbidden
# Expected: Message about admin routes
```

### Step 5.3: OIDC Flow Validation

**Verify OIDC Endpoints**:

1. **Discovery Endpoint**:

   ```bash
   curl https://app.replybase.co.uk/api/oidc/.well-known/openid-configuration

   # Expected: JSON with issuer, endpoints, supported scopes
   ```

2. **JWKS Endpoint**:

   ```bash
   curl https://app.replybase.co.uk/api/oidc/.well-known/jwks.json

   # Expected: JSON with "keys" array
   # Expected: Key has "kty", "kid", "use", "alg" properties
   ```

3. **Authorization Endpoint**:

   ```bash
   # This should redirect (manually test in browser)
   # https://app.replybase.co.uk/api/oidc/auth?client_id=typebot-engine&...

   # Expected: Login prompt or redirect if already logged in
   ```

**Token Claims Validation**:

1. Log in to SaaS app
2. Open browser DevTools → Network
3. Click "Launch Builder"
4. Find OIDC token exchange request
5. Decode JWT (use jwt.io):
   ```json
   {
     "sub": "<user_id>",
     "email": "test@example.com",
     "email_verified": true,
     "name": "Test User",
     "plan": "starter", // ← Must be present
     "subscription_status": "active", // ← Must be "active"
     "tenantId": "<tenant_id>",
     "iss": "https://app.replybase.co.uk/api/oidc",
     "aud": "typebot-engine"
   }
   ```

**✅ Validation Checklist**:

- [ ] Discovery endpoint returns correct configuration
- [ ] JWKS endpoint returns valid keys
- [ ] Authorization flow completes successfully
- [ ] Token includes `plan` claim
- [ ] Token includes `subscription_status` claim
- [ ] Token `iss` matches SaaS app URL
- [ ] Token `aud` matches `typebot-engine`

### Step 5.4: Performance & Load Testing (Basic)

**Test API Response Times**:

```bash
# Health check
time curl https://app.replybase.co.uk/api/health

# Expected: < 200ms

# Database query (requires auth)
# Time how long it takes to load bots page
```

**Test Concurrent Users** (optional for MVP):

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test 100 requests, 10 concurrent
ab -n 100 -c 10 https://app.replybase.co.uk/api/health

# Review results for failures
```

### Step 5.5: Error Handling & Logging

**Test Error Scenarios**:

1. **Invalid OAuth Callback**:
   - Manually craft invalid OIDC callback URL
   - Expected: Error page with helpful message
   - Expected: Error logged in server logs

2. **Database Connection Failure**:
   - Temporarily break DATABASE_URL
   - Try to access app
   - Expected: Error page (not crash)
   - Restore DATABASE_URL

3. **Stripe Webhook Failure**:
   - Send test webhook from Stripe dashboard
   - Check logs for processing
   - Expected: Webhook handled gracefully

**Review Logs**:

```bash
# SaaS App logs
docker logs -f --tail=100 replybase-saas

# Look for:
# - OIDC flow events
# - Token validation
# - Subscription checks
# - Errors/warnings

# Typebot Engine logs
docker logs -f --tail=100 typebot-engine

# Look for:
# - OIDC authentication events
# - Token validation
# - Errors
```

**✅ Success Criteria**:

- All user flows complete successfully
- Security tests confirm restrictions work
- OIDC endpoints return valid data
- Errors handled gracefully
- Logs show no critical errors

---

## Phase 6: Go Live

**Duration**: 1 day  
**Risk**: 🟡 Medium

### Step 6.1: Final Pre-Launch Checklist

**Configuration**:

- [ ] All environment variables set and validated
- [ ] Database migrations applied
- [ ] Stripe plans seeded
- [ ] OIDC keys generated and configured
- [ ] SSL certificates valid for all domains
- [ ] DNS pointing to correct servers

**Security**:

- [ ] Nginx rules applied and tested
- [ ] Direct Engine access blocked
- [ ] Viewer admin routes blocked
- [ ] OIDC token validation working
- [ ] Subscription gating enforced

**Testing**:

- [ ] End-to-end user flow tested
- [ ] OIDC flow validated
- [ ] Security tests passed
- [ ] Error handling verified
- [ ] Logs reviewed for issues

**Documentation**:

- [ ] Deployment documented
- [ ] Environment variables documented
- [ ] Rollback plan ready
- [ ] Support contacts identified

### Step 6.2: Create Monitoring Alerts (Recommended)

**Set up basic uptime monitoring**:

1. **UptimeRobot** (free tier):
   - Monitor `https://app.replybase.co.uk/api/health`
   - Monitor `https://engine.replybase.co.uk` (expect 403, monitor for 5xx errors)
   - Alert via email if down > 5 minutes

2. **Simple Log Monitoring**:

   ```bash
   # Create a cron job to email errors
   # On server:
   crontab -e

   # Add:
   */15 * * * * docker logs --since 15m replybase-saas 2>&1 | grep -i "error" | mail -s "SaaS Errors" your@email.com
   ```

### Step 6.3: Soft Launch

**Invite Limited Users**:

1. Create 3-5 test accounts
2. Invite trusted users/team members
3. Monitor for 24-48 hours
4. Gather feedback
5. Fix any critical issues

**Monitoring During Soft Launch**:

```bash
# Watch logs in real-time
ssh root@104.248.160.102
docker logs -f replybase-saas

# In another terminal
docker logs -f typebot-engine

# Look for:
# - Authentication errors
# - OIDC failures
# - Database errors
# - Rate limiting issues
```

### Step 6.4: Public Launch

**Once soft launch is stable**:

1. **Announce on Marketing Channels**:
   - Update website
   - Social media announcement
   - Email to waitlist (if any)

2. **Monitor Closely for First Week**:
   - Check logs daily
   - Respond to user issues quickly
   - Track key metrics:
     - New user signups
     - Subscription conversions
     - OIDC flow success rate
     - Error rates

3. **Be Prepared for Issues**:
   - Have rollback plan ready (see below)
   - Monitor Stripe for failed payments
   - Watch for abuse/bot signups
   - Have support email ready

**✅ Go Live Checklist**:

- [ ] Soft launch completed (3-5 users tested)
- [ ] No critical errors in 48-hour period
- [ ] Monitoring in place
- [ ] Support process defined
- [ ] Rollback plan tested
- [ ] Team briefed on launch
- [ ] Public announcement ready

---

## Post-Deployment

### Week 1: Immediate Monitoring

**Daily Tasks**:

- [ ] Check application logs for errors
- [ ] Monitor uptime (should be > 99.5%)
- [ ] Review new user signups
- [ ] Check subscription conversions
- [ ] Respond to user support emails
- [ ] Monitor Stripe for payment issues

**Metrics to Track**:

```sql
-- New users today
SELECT COUNT(*) FROM users WHERE "createdAt" > NOW() - INTERVAL '1 day';

-- Active subscriptions
SELECT COUNT(*) FROM subscriptions WHERE status = 'active';

-- OIDC authentications (from logs or add analytics)
-- Bot builder access count
```

### Week 2: Optimization

**Implement**:

- [ ] Add comprehensive logging (Winston, Pino)
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (PostHog, Mixpanel, or custom)
- [ ] Optimize slow queries
- [ ] Add database indexes if needed
- [ ] Review rate limiting effectiveness

### Month 1: Improvements

**Feature Enhancements**:

- [ ] Add email notifications
- [ ] Implement usage dashboard
- [ ] Add billing history
- [ ] Create admin panel
- [ ] Improve onboarding flow
- [ ] Add help documentation

**Infrastructure**:

- [ ] Set up automated backups
- [ ] Implement disaster recovery
- [ ] Add CDN for static assets
- [ ] Optimize Docker images
- [ ] Set up staging environment

---

## Rollback Plan

### When to Rollback

**Immediate Rollback Triggers**:

- [ ] > 50% of OIDC flows failing
- [ ] Database corruption or data loss
- [ ] Security vulnerability exploited
- [ ] Complete service outage > 30 minutes
- [ ] Payment processing completely broken

**Consider Rollback**:

- [ ] > 20% error rate
- [ ] Critical feature broken
- [ ] Major performance degradation
- [ ] Can't fix forward in < 2 hours

### Rollback Procedure

#### Option 1: Rollback to Previous Code Version

**In Coolify**:

1. Go to application settings
2. Find deployment history
3. Click "Rollback" to previous version
4. Confirm rollback
5. Wait for redeployment (~5 minutes)

**Verify**:

```bash
# Check application health
curl https://app.replybase.co.uk/api/health

# Check logs
docker logs -f replybase-saas
```

#### Option 2: Rollback Environment Variables

**If issue is env var related**:

1. In Coolify, go to Environment Variables
2. Revert problematic variables
3. Restart application
4. Test functionality

#### Option 3: Database Rollback

**⚠️ DANGEROUS - Only if absolutely necessary**:

```bash
# Restore from backup
psql $DATABASE_URL < backup-YYYY-MM-DD.sql

# Rollback specific migration
npx prisma migrate resolve --rolled-back <migration_name>
```

### Post-Rollback Actions

1. **Notify Users**:
   - Status page update
   - Email to active users
   - Social media update

2. **Investigate Root Cause**:
   - Review logs
   - Identify what went wrong
   - Document findings

3. **Fix and Redeploy**:
   - Fix issue in code
   - Test thoroughly in staging
   - Redeploy with fix
   - Monitor closely

---

## Emergency Contacts

**Technical**:

- **Primary Developer**: [Your Name/Email]
- **DevOps**: [If separate]
- **Database Admin**: [If separate]

**Services**:

- **Digital Ocean Support**: support@digitalocean.com
- **Coolify Support**: [Support channel]
- **Stripe Support**: [Your account manager or support]

**Escalation**:

1. Try to fix in < 30 minutes
2. If can't fix, consider rollback
3. If rollback doesn't help, contact service providers
4. Document everything for post-mortem

---

## Success Metrics

### Week 1 Goals

- [ ] 0 critical errors
- [ ] > 99% uptime
- [ ] 10+ new user signups
- [ ] 3+ active subscriptions
- [ ] 0 security incidents

### Month 1 Goals

- [ ] 50+ new users
- [ ] 20+ active subscriptions
- [ ] < 1% error rate
- [ ] 99.9% uptime
- [ ] Positive user feedback

### Month 3 Goals

- [ ] 200+ users
- [ ] 50+ paid subscriptions
- [ ] 99.95% uptime
- [ ] All post-launch improvements implemented
- [ ] Preparing for scale

---

## Appendix

### A. Environment Variables Reference

See `.env.production` template created in Phase 1, Step 1.2

### B. Useful Commands

```bash
# SSH into server
ssh root@104.248.160.102

# Check Docker containers
docker ps

# View application logs
docker logs -f replybase-saas
docker logs -f typebot-engine

# Restart application
# (via Coolify UI or:)
docker restart replybase-saas

# Database access
psql $DATABASE_URL

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Check Nginx config
nginx -t

# Reload Nginx
nginx -s reload
```

### C. Troubleshooting Guide

**Issue**: OIDC flow fails with "Invalid client"

- **Solution**: Check `TYPEBOT_OIDC_CLIENT_ID` matches in both SaaS and Engine

**Issue**: "JWKS not found" error

- **Solution**: Verify `OIDC_JWKS` is valid JSON and properly formatted

**Issue**: Subscription check always fails

- **Solution**: Verify plans are seeded and subscription exists in DB

**Issue**: Can't access Typebot Engine at all

- **Solution**: Check Nginx rules aren't blocking OIDC callback endpoint

**Issue**: Token validation fails on Engine

- **Solution**: Verify Engine can reach `https://app.replybase.co.uk/api/oidc/.well-known/jwks.json`

### D. Additional Resources

- **Typebot Documentation**: https://docs.typebot.io
- **OIDC Specification**: https://openid.net/specs/openid-connect-core-1_0.html
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Production Best Practices**: https://www.prisma.io/docs/guides/deployment
- **Coolify Documentation**: https://coolify.io/docs

---

**Plan Created**: January 30, 2026  
**Estimated Completion**: February 6-9, 2026  
**Risk Level**: 🟡 Medium (with careful execution)  
**Success Probability**: 🟢 High (85%+ with this plan)

**Next Step**: Begin Phase 1 - Environment Configuration
