# Phase 1: Current State Analysis

## 🔍 Findings

### ✅ Existing Infrastructure

1. **OIDC Provider**: Already configured in `lib/oidc-provider.ts`

   - Uses `oidc-provider` library
   - Configured with Prisma adapter
   - Has basic subscription gating in `findAccount`

2. **SaaS Authentication**: NextAuth configured with:

   - Google OAuth
   - Facebook OAuth
   - Credentials provider
   - Subscription status tracked in JWT tokens

3. **OIDC Endpoint**: `/api/oidc/[...oidc]/route.ts` exists and handles OIDC requests

### ❌ Critical Issues Found

1. **Direct Typebot Access**:

   - `app/(dashboard)/bots/page.tsx` has direct link to `engine.replybase.co.uk`
   - No OIDC flow - users can access Typebot directly
   - **SECURITY RISK**: Bypasses SaaS control

2. **OIDC Provider Bugs**:

   - `findAccount` treats `subscriptions` as single object, but it's an array
   - Claims may not include all required fields (plan, subscription_status)
   - Issuer URL may not match production (`NEXT_PUBLIC_APP_URL`)

3. **Missing Components**:

   - No API route to generate OIDC authorization URLs
   - No secure redirect mechanism from SaaS → Engine
   - No infrastructure documentation for reverse proxy rules

4. **OIDC Claims Configuration**:
   - Custom claims (plan, subscription_status) not explicitly registered
   - Need to ensure `iss` and `aud` match requirements

### 🔧 Required Fixes

1. Fix OIDC provider subscription handling
2. Add custom claims registration
3. Create `/api/typebot/authorize` route for secure redirects
4. Update bots page to use secure redirect
5. Ensure issuer URL is correct
6. Add infrastructure documentation

## 📋 Typebot Configuration Status

**Note**: Typebot configuration is external to this codebase. The following must be configured on the Typebot Engine:

1. **Disable Public Auth**: Google, Facebook, Email/Password login must be disabled
2. **Enable OIDC**: Configure OIDC provider pointing to `https://app.replybase.co.uk/api/oidc`
3. **Token Validation**: Engine must validate tokens and check `subscription_status === 'active'`
4. **Access Control**: Engine must reject requests without valid tokens

## 🎯 Next Steps

See implementation files for detailed fixes.
