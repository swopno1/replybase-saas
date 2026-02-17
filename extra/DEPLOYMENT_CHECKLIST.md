# ✅ Production Deployment Checklist

**Use this checklist to track your deployment progress**

---

## 📋 Pre-Deployment Setup

### Access & Accounts

- [ ] SSH access to Digital Ocean: `ssh root@104.248.160.102`
- [ ] Coolify dashboard access confirmed
- [ ] PostgreSQL database URL available
- [ ] Google Cloud Console account
- [ ] Facebook Developers account
- [ ] Stripe account (test or live mode)
- [ ] Password manager for storing secrets

### Domain Configuration

- [ ] `app.replybase.co.uk` DNS configured
- [ ] `engine.replybase.co.uk` DNS configured
- [ ] `bot.replybase.co.uk` DNS configured
- [ ] SSL certificates active for all domains
- [ ] All domains resolve correctly

### External Services Setup

- [ ] Google OAuth app created
  - [ ] Client ID obtained
  - [ ] Client Secret obtained
  - [ ] Redirect URI configured: `https://app.replybase.co.uk/api/auth/callback/google`
- [ ] Facebook OAuth app created
  - [ ] App ID obtained
  - [ ] App Secret obtained
  - [ ] Redirect URI configured: `https://app.replybase.co.uk/api/auth/callback/facebook`
- [ ] Stripe account configured
  - [ ] Secret key obtained
  - [ ] Publishable key obtained
  - [ ] Webhook endpoint created: `https://app.replybase.co.uk/api/billing/webhook`
  - [ ] Webhook secret obtained

---

## 🔐 Phase 1: Environment Configuration

### Key Generation

- [ ] OIDC keys generated: `node scripts/generate-jwks.js`
  - [ ] `OIDC_JWKS` saved to password manager
  - [ ] `OIDC_COOKIE_KEY` saved to password manager
- [ ] AUTH_SECRET generated: `openssl rand -base64 32`
  - [ ] Saved to password manager
- [ ] TYPEBOT_OIDC_CLIENT_SECRET generated: `openssl rand -base64 32`
  - [ ] Saved to password manager

### Environment Variables - Core

- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_APP_URL=https://app.replybase.co.uk`
- [ ] `AUTH_SECRET=<generated>`
- [ ] `NEXTAUTH_URL=https://app.replybase.co.uk`

### Environment Variables - OAuth

- [ ] `GOOGLE_CLIENT_ID=<from_google>`
- [ ] `GOOGLE_CLIENT_SECRET=<from_google>`
- [ ] `FACEBOOK_CLIENT_ID=<from_facebook>`
- [ ] `FACEBOOK_CLIENT_SECRET=<from_facebook>`
- [ ] `FACEBOOK_WEBHOOK_VERIFY_TOKEN=<random_string>`

### Environment Variables - OIDC

- [ ] `OIDC_JWKS=<generated_json>`
- [ ] `OIDC_COOKIE_KEY=<generated_hex>`
- [ ] `TYPEBOT_OIDC_CLIENT_ID=typebot-engine`
- [ ] `TYPEBOT_OIDC_CLIENT_SECRET=<generated>`
- [ ] `TYPEBOT_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback`

### Environment Variables - Database

- [ ] `DATABASE_URL=postgresql://...`

### Environment Variables - Stripe

- [ ] `STRIPE_SECRET_KEY=sk_live_...` or `sk_test_...`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` or `pk_test_...`

### Environment Variables - Stripe Price IDs (after seeding)

- [ ] `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...`
- [ ] `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...`
- [ ] `NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID=price_...`

### Coolify Configuration

- [ ] All environment variables added to Coolify UI
- [ ] OR `.env` file created on server
- [ ] Environment variables validated (no typos)
- [ ] OIDC_JWKS formatted correctly (valid JSON)

---

## 💾 Phase 2: Database Setup

### Database Connection

- [ ] Database connection tested: `psql $DATABASE_URL -c "SELECT version();"`
- [ ] Connection successful
- [ ] SSL mode configured if required

### Prisma Setup

- [ ] Prisma Client generated: `npx prisma generate`
- [ ] Migrations applied: `npx prisma migrate deploy`
- [ ] All tables created successfully
- [ ] Tables verified: `psql $DATABASE_URL -c "\dt"`

### Required Tables Exist

- [ ] `users`
- [ ] `accounts`
- [ ] `sessions`
- [ ] `tenants`
- [ ] `subscriptions`
- [ ] `plans`
- [ ] `bots`
- [ ] `oidc_models`
- [ ] Other tables as per schema

### Database Seeding

- [ ] Stripe plans seeded: `npm run seed:stripe`
- [ ] Plans verified in database: `SELECT * FROM plans;`
- [ ] 3 plans exist: Starter, Pro, Business
- [ ] Price IDs updated in environment variables

---

## 🤖 Phase 3: Typebot Configuration

### Typebot Engine Access

- [ ] Can access Typebot Engine: `https://engine.replybase.co.uk`
- [ ] Current configuration documented (screenshot)
- [ ] Backup of existing settings created

### Disable Public Authentication

- [ ] Google OAuth disabled on Typebot
  - [ ] Via env: `DISABLE_GOOGLE_AUTH=true`
  - [ ] OR via UI: Settings → Authentication → Disable Google
- [ ] Facebook OAuth disabled on Typebot
  - [ ] Via env: `DISABLE_FACEBOOK_AUTH=true`
  - [ ] OR via UI: Settings → Authentication → Disable Facebook
- [ ] Email/Password disabled on Typebot
  - [ ] Via env: `DISABLE_EMAIL_AUTH=true`
  - [ ] OR via UI: Settings → Authentication → Disable Email/Password

### OIDC Configuration on Typebot

- [ ] OIDC environment variables set on Typebot Engine:
  - [ ] `OIDC_ISSUER=https://app.replybase.co.uk/api/oidc`
  - [ ] `OIDC_CLIENT_ID=typebot-engine`
  - [ ] `OIDC_CLIENT_SECRET=<matches_saas_app>`
  - [ ] `OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback`
  - [ ] `OIDC_SCOPE=openid email profile plan subscription_status`
- [ ] OR OIDC configured via Typebot UI:
  - [ ] Generic OIDC provider enabled
  - [ ] Issuer URL set
  - [ ] Client ID set
  - [ ] Client Secret set
  - [ ] Callback URL set
  - [ ] Scopes configured
- [ ] Typebot Engine restarted
- [ ] Configuration saved and verified

### Token Validation (if self-hosted Typebot)

- [ ] Token validation middleware implemented
- [ ] Middleware applied to protected routes
- [ ] Subscription status check added
- [ ] Testing completed

---

## 🔒 Phase 4: Infrastructure Security

### Nginx Configuration - Typebot Engine

- [ ] Access Coolify → Typebot Engine → Advanced → Custom Nginx
- [ ] Access control rules added:
  ```nginx
  set $allow_access 0;
  if ($http_authorization) { set $allow_access 1; }
  if ($http_referer ~* "^https://app\.replybase\.co\.uk") { set $allow_access 1; }
  if ($allow_access = 0) {
      return 403 "Direct access forbidden. Use app.replybase.co.uk";
  }
  ```
- [ ] OIDC callback endpoint allowed:
  ```nginx
  location = /api/auth/oauth/generic-oidc/callback {
      # Allow without restrictions
  }
  ```
- [ ] Configuration saved
- [ ] Nginx reloaded: `nginx -s reload`

### Nginx Configuration - Typebot Viewer

- [ ] Admin routes blocked:
  ```nginx
  location ~ ^/(builder|settings|analytics|admin|api/bots|api/workspaces|api/users) {
      return 403 "Admin routes not accessible on viewer domain";
  }
  ```
- [ ] Public routes allowed
- [ ] Configuration saved
- [ ] Nginx reloaded

### Access Restrictions Testing

- [ ] Direct Engine access blocked: `curl -I https://engine.replybase.co.uk`
  - [ ] Returns 403 Forbidden
- [ ] Engine with Authorization header works
- [ ] Viewer admin routes blocked: `curl -I https://bot.replybase.co.uk/builder`
  - [ ] Returns 403 Forbidden
- [ ] Viewer public routes work: `curl -I https://bot.replybase.co.uk/`
  - [ ] Returns 200 OK

---

## 🧪 Phase 5: Testing & Validation

### OIDC Endpoints

- [ ] Discovery endpoint: `curl https://app.replybase.co.uk/api/oidc/.well-known/openid-configuration`
  - [ ] Returns valid JSON
  - [ ] Contains issuer, endpoints, scopes
- [ ] JWKS endpoint: `curl https://app.replybase.co.uk/api/oidc/.well-known/jwks.json`
  - [ ] Returns valid JSON
  - [ ] Contains keys with kty, kid, use, alg

### User Flow Testing

- [ ] **New User Registration**
  - [ ] Register at `https://app.replybase.co.uk/auth/register`
  - [ ] Email verification (if enabled)
  - [ ] Redirect to dashboard
  - [ ] Tenant created automatically
- [ ] **Subscription**
  - [ ] Navigate to pricing page
  - [ ] Select a plan
  - [ ] Complete Stripe checkout (test card: 4242 4242 4242 4242)
  - [ ] Redirect back to app
  - [ ] Subscription status shows "active"
- [ ] **Bot Builder Access**
  - [ ] Navigate to `/bots`
  - [ ] Click "Launch Builder" button
  - [ ] OIDC flow initiates
  - [ ] Redirect to Typebot Engine
  - [ ] Auto-login successful
  - [ ] Can create/edit bots

### Security Testing

- [ ] **Direct Engine Access** (should fail)
  - [ ] Open incognito browser
  - [ ] Go to `https://engine.replybase.co.uk`
  - [ ] Verify 403 Forbidden
- [ ] **Expired/Invalid Token** (should fail)
  - [ ] Try API call with fake token
  - [ ] Verify 401 Unauthorized
- [ ] **Inactive Subscription** (should fail)
  - [ ] Manually set subscription to "canceled" in DB
  - [ ] Log out and log back in
  - [ ] Try to access builder
  - [ ] Verify redirect to pricing page
- [ ] **Viewer Admin Access** (should fail)
  - [ ] Go to `https://bot.replybase.co.uk/builder`
  - [ ] Verify 403 Forbidden

### Token Validation

- [ ] OIDC token obtained (via browser DevTools)
- [ ] Token decoded (use jwt.io)
- [ ] Token contains required claims:
  - [ ] `sub` (user ID)
  - [ ] `email`
  - [ ] `name`
  - [ ] `plan` (starter/pro/business)
  - [ ] `subscription_status` (active/trialing)
  - [ ] `tenantId`
  - [ ] `iss` (https://app.replybase.co.uk/api/oidc)
  - [ ] `aud` (typebot-engine)

### Error Handling

- [ ] Invalid OAuth callback handled gracefully
- [ ] Database connection failure shows error page (not crash)
- [ ] Stripe webhook test successful
- [ ] Logs reviewed for critical errors

### Performance Testing (Basic)

- [ ] Health endpoint response time < 200ms
- [ ] Dashboard loads in < 2 seconds
- [ ] OIDC flow completes in < 5 seconds

---

## 🚀 Phase 6: Go Live

### Pre-Launch Final Check

- [ ] All environment variables verified
- [ ] Database migrations applied
- [ ] Stripe plans seeded
- [ ] OIDC working end-to-end
- [ ] Security tests passed
- [ ] Logs show no critical errors
- [ ] SSL certificates valid
- [ ] DNS correct for all domains

### Monitoring Setup

- [ ] Uptime monitoring configured (UptimeRobot or similar)
  - [ ] Monitor: `https://app.replybase.co.uk/api/health`
  - [ ] Alert on downtime > 5 minutes
- [ ] Log monitoring configured (optional)
  - [ ] Cron job for error emails
  - [ ] OR log aggregation service
- [ ] Error tracking setup (optional)
  - [ ] Sentry or similar

### Soft Launch

- [ ] 3-5 test accounts created
- [ ] Trusted users invited
- [ ] Monitor for 24-48 hours
- [ ] No critical errors in logs
- [ ] User feedback collected
- [ ] Critical issues fixed

### Public Launch

- [ ] Soft launch successful (no critical issues)
- [ ] Marketing materials prepared
- [ ] Announcement ready (email, social media, website)
- [ ] Support email monitored
- [ ] Rollback plan documented and ready

---

## 📊 Post-Deployment (Week 1)

### Daily Monitoring

- [ ] Day 1: Check logs for errors
- [ ] Day 1: Monitor uptime
- [ ] Day 1: Review user signups
- [ ] Day 2: Check logs for errors
- [ ] Day 2: Monitor subscription conversions
- [ ] Day 3: Check logs for errors
- [ ] Day 3: Respond to support emails
- [ ] Day 4: Check logs for errors
- [ ] Day 4: Monitor Stripe for payment issues
- [ ] Day 5: Check logs for errors
- [ ] Day 5: Review performance metrics
- [ ] Day 6: Check logs for errors
- [ ] Day 6: Plan improvements
- [ ] Day 7: Week 1 review
- [ ] Day 7: Document any issues encountered

### Metrics Tracking

- [ ] New user signups counted
- [ ] Active subscriptions counted
- [ ] OIDC flow success rate tracked
- [ ] Error rates monitored
- [ ] Uptime percentage calculated

---

## 🔧 Post-Deployment (Week 2)

### Optimization

- [ ] Add comprehensive logging (Winston/Pino)
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (PostHog/Mixpanel/Custom)
- [ ] Optimize slow queries
- [ ] Add database indexes if needed
- [ ] Review rate limiting effectiveness

---

## 🎯 Success Metrics

### Week 1 Goals

- [ ] 0 critical errors
- [ ] > 99% uptime
- [ ] 10+ new user signups
- [ ] 3+ active subscriptions
- [ ] 0 security incidents

### Overall Success

- [ ] Users can register successfully
- [ ] Users can subscribe via Stripe
- [ ] Users can access Typebot Builder via OIDC
- [ ] Direct Engine access is blocked
- [ ] All security tests pass
- [ ] No data breaches or security incidents
- [ ] System stable for 7+ days

---

## 🚨 Rollback Triggers

**Immediate Rollback If**:

- [ ] > 50% of OIDC flows failing
- [ ] Database corruption or data loss
- [ ] Security vulnerability exploited
- [ ] Complete service outage > 30 minutes
- [ ] Payment processing completely broken

**Rollback Procedure**: See [PRODUCTION_DEPLOYMENT_PLAN.md - Rollback Plan](./PRODUCTION_DEPLOYMENT_PLAN.md#rollback-plan)

---

## 📝 Notes & Issues

**Use this space to track issues encountered during deployment**:

### Issues Encountered

1.
2.
3.

### Solutions Applied

1.
2.
3.

### Lessons Learned

1.
2.
3.

---

**Deployment Started**: **_/_**/**\_  
**Deployment Completed**: \_**/**_/_**  
**Time Taken**: **\_** days/hours  
**Status**: ⬜ In Progress / ✅ Complete

---

**Last Updated**: January 30, 2026  
**Version**: 1.0
