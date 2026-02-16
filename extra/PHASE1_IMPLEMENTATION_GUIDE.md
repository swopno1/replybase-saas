# Phase 1: Implementation Guide

## 📋 Overview

This guide documents the complete implementation of Phase 1: Private Engine Auth & Access Control (OIDC-Based) for ReplyBase.

## ✅ Completed Implementation

### 1. OIDC Provider Configuration (`lib/oidc-provider.ts`)

**Changes Made:**

- Fixed subscription handling (subscriptions is an array, not a single object)
- Added custom claims: `plan`, `subscription_status`
- Ensured issuer URL is correct (`https://app.replybase.co.uk/api/oidc`)
- Added claim normalization for plan names (starter | pro | enterprise)
- Strict subscription gating: users without active subscriptions are denied access

**Key Features:**

- Subscription status validation in `findAccount`
- Custom claims included in tokens:
  ```json
  {
    "sub": "user_id",
    "email": "user@email.com",
    "plan": "starter | pro | enterprise",
    "subscription_status": "active",
    "iss": "https://app.replybase.co.uk/api/oidc",
    "aud": "typebot-engine"
  }
  ```

### 2. Secure Authorization Endpoint (`app/api/typebot/authorize/route.ts`)

**Purpose:** The ONLY way users should access Typebot Builder.

**Features:**

- Verifies user authentication in SaaS
- Validates subscription status (active or trialing)
- Generates OIDC authorization URL
- Supports both GET (JSON response) and POST (direct redirect)

**Security:**

- Returns 401 if user not authenticated
- Returns 403 if subscription inactive
- Redirects to pricing page if subscription required

### 3. Updated Bots Page (`app/(dashboard)/bots/page.tsx`)

**Changes:**

- Converted to client component
- Replaced direct link with secure button
- Calls `/api/typebot/authorize` endpoint
- Handles errors and redirects appropriately

**User Flow:**

1. User clicks "Launch Builder"
2. Frontend calls `/api/typebot/authorize` (POST)
3. SaaS verifies auth and subscription
4. SaaS generates OIDC authorization URL
5. User redirected to OIDC flow
6. Typebot Engine validates token and grants access

### 4. Infrastructure Documentation (`INFRASTRUCTURE_SECURITY.md`)

**Contents:**

- Nginx configuration examples
- Traefik configuration examples
- Coolify setup instructions
- Reverse proxy rules for Engine and Viewer
- Security verification checklist

## 🔧 Required Environment Variables

### SaaS App (app.replybase.co.uk)

```env
# OIDC Provider Configuration
NEXT_PUBLIC_APP_URL=https://app.replybase.co.uk
OIDC_COOKIE_KEY=<secure-random-key>
OIDC_JWKS=<jwks-json-or-base64>

# Typebot OIDC Client Configuration
TYPEBOT_OIDC_CLIENT_ID=typebot-engine
TYPEBOT_OIDC_CLIENT_SECRET=<secure-secret>
TYPEBOT_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback

# Typebot URLs (for reference, not used in direct links)
NEXT_PUBLIC_TYPEBOT_BUILDER_URL=https://engine.replybase.co.uk
NEXT_PUBLIC_TYPEBOT_VIEWER_URL=https://bot.replybase.co.uk
```

### Typebot Engine (engine.replybase.co.uk)

```env
# Disable Public Auth Providers
DISABLE_GOOGLE_AUTH=true
DISABLE_FACEBOOK_AUTH=true
DISABLE_EMAIL_AUTH=true

# OIDC Configuration
OIDC_ISSUER=https://app.replybase.co.uk/api/oidc
OIDC_CLIENT_ID=typebot-engine
OIDC_CLIENT_SECRET=<same-as-saas>
OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback

# Token Validation
# Engine must validate:
# - Token signature using JWKS from https://app.replybase.co.uk/api/oidc/.well-known/jwks.json
# - subscription_status === 'active'
# - iss === 'https://app.replybase.co.uk/api/oidc'
# - aud === 'typebot-engine'
```

## 🚀 Deployment Checklist

### SaaS App Deployment

- [ ] Set all required environment variables
- [ ] Generate secure `OIDC_COOKIE_KEY` (32+ character random string)
- [ ] Generate JWKS keys for token signing
- [ ] Set `NEXT_PUBLIC_APP_URL` to production URL
- [ ] Verify OIDC endpoint is accessible: `https://app.replybase.co.uk/api/oidc/.well-known/openid-configuration`
- [ ] Test authorization endpoint: `POST /api/typebot/authorize`

### Typebot Engine Deployment

- [ ] Disable all public auth providers
- [ ] Configure OIDC provider settings
- [ ] Implement token validation middleware:
  - Verify token signature
  - Check `subscription_status === 'active'`
  - Reject requests without valid tokens (401/403)
- [ ] Block public routes: `/auth/*`, `/signin`, `/signup`
- [ ] Test OIDC flow end-to-end

### Infrastructure Configuration

- [ ] Configure reverse proxy rules (see `INFRASTRUCTURE_SECURITY.md`)
- [ ] Block direct access to `engine.replybase.co.uk`
- [ ] Allow OIDC callback endpoint
- [ ] Configure Viewer domain to block admin routes
- [ ] Set up SSL certificates
- [ ] Test access control rules

## 🧪 Testing

### Test Cases

1. **Direct Engine Access (Should Fail)**

   ```bash
   curl https://engine.replybase.co.uk
   # Expected: 403 Forbidden
   ```

2. **Unauthenticated Authorization (Should Fail)**

   ```bash
   curl -X POST https://app.replybase.co.uk/api/typebot/authorize
   # Expected: 401 Unauthorized or redirect to /auth/login
   ```

3. **Inactive Subscription (Should Fail)**

   ```bash
   # User with inactive subscription
   curl -X POST https://app.replybase.co.uk/api/typebot/authorize \
     -H "Cookie: next-auth.session-token=..."
   # Expected: 403 Forbidden or redirect to /pricing
   ```

4. **Valid Authorization Flow (Should Succeed)**

   ```bash
   # User with active subscription
   curl -X POST https://app.replybase.co.uk/api/typebot/authorize \
     -H "Cookie: next-auth.session-token=..."
   # Expected: Redirect to OIDC authorization URL
   ```

5. **OIDC Token Validation**
   - Verify token includes required claims
   - Verify `subscription_status === 'active'`
   - Verify token signature is valid
   - Verify `iss` and `aud` match requirements

## 🔍 Verification

### Success Criteria

- [ ] Visiting `engine.replybase.co.uk` directly returns 401/403
- [ ] No login UI exists on engine or viewer
- [ ] Cancelled user cannot access builder
- [ ] Active user can access builder ONLY via SaaS
- [ ] Stripe subscription state fully controls access
- [ ] No public anchor links expose engine/viewer URLs
- [ ] OIDC tokens include all required claims
- [ ] Token validation works correctly on Engine

### Monitoring

Monitor the following:

- Failed authorization attempts (401/403 responses)
- OIDC token generation success rate
- Subscription status checks
- Direct access attempts to Engine
- Token validation failures on Engine

## 📝 Notes

1. **Typebot Configuration**: The Typebot Engine configuration is external to this codebase. Ensure Typebot is configured according to the requirements in `INFRASTRUCTURE_SECURITY.md`.

2. **JWKS Keys**: Generate secure JWKS keys for production. The OIDC provider uses these to sign tokens. Typebot Engine will use the public JWKS to verify tokens.

3. **Token Lifetime**: Consider token expiration times. OIDC tokens should have reasonable expiration (e.g., 1 hour) with refresh token support.

4. **Error Handling**: Ensure proper error messages don't leak sensitive information. Return generic errors to users, log detailed errors server-side.

5. **Rate Limiting**: Consider adding rate limiting to the authorization endpoint to prevent abuse.

## 🐛 Troubleshooting

### Issue: OIDC authorization URL generation fails

**Check:**

- OIDC provider is initialized correctly
- Environment variables are set
- JWKS keys are configured
- Issuer URL is correct

### Issue: Token validation fails on Engine

**Check:**

- Engine has correct OIDC configuration
- JWKS endpoint is accessible
- Token claims match requirements
- Clock skew is accounted for

### Issue: Users can still access Engine directly

**Check:**

- Reverse proxy rules are configured
- Infrastructure-level blocking is active
- No direct links in frontend code
- Browser cache is cleared

## 📚 References

- OIDC Provider Library: https://github.com/panva/node-oidc-provider
- OIDC Specification: https://openid.net/specs/openid-connect-core-1_0.html
- Typebot Documentation: (Typebot-specific OIDC configuration)
