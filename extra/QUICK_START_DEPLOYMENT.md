# ⚡ Quick Start Guide - Production Deployment

**Time to Deploy**: 1-2 hours (after reading documentation)  
**Prerequisites**: Basic terminal/SSH knowledge, access to Digital Ocean

---

## 🎯 Goal

Deploy ReplyBase SaaS with secure Typebot Builder/Viewer integration.

---

## 📚 Read First

1. **[PRODUCTION_DIAGNOSIS_REPORT.md](./PRODUCTION_DIAGNOSIS_REPORT.md)** - Understand current state
2. **[PRODUCTION_DEPLOYMENT_PLAN.md](./PRODUCTION_DEPLOYMENT_PLAN.md)** - Detailed plan
3. **This file** - Quick reference

---

## ⚡ Fast Track (Experienced Developers)

### 1. Generate Keys (5 mins)

```bash
# Generate OIDC keys
node scripts/generate-jwks.js > keys.txt

# Generate secrets
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> keys.txt
echo "TYPEBOT_SECRET=$(openssl rand -base64 32)" >> keys.txt

# SAVE keys.txt TO PASSWORD MANAGER
# Then delete: rm keys.txt
```

### 2. Configure Environment (10 mins)

```bash
# Copy template
cp .env.example .env

# Edit .env with your values
nano .env
# OR use Coolify UI to add environment variables

# Must set:
# - All OIDC_ variables (from keys.txt)
# - AUTH_SECRET (from keys.txt)
# - TYPEBOT_OIDC_CLIENT_SECRET (from keys.txt)
# - DATABASE_URL (your PostgreSQL)
# - All STRIPE_ variables
# - All GOOGLE_ and FACEBOOK_ OAuth credentials
```

### 3. Setup Database (5 mins)

```bash
# SSH into server
ssh root@104.248.160.102

# Run migrations
npx prisma generate
npx prisma migrate deploy

# Seed Stripe plans
npm run seed:stripe
```

### 4. Configure Typebot Engine (30 mins)

**In Typebot Engine environment**:

```env
OIDC_ISSUER=https://app.replybase.co.uk/api/oidc
OIDC_CLIENT_ID=typebot-engine
OIDC_CLIENT_SECRET=<same_as_TYPEBOT_OIDC_CLIENT_SECRET>
OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback

DISABLE_GOOGLE_AUTH=true
DISABLE_FACEBOOK_AUTH=true
DISABLE_EMAIL_AUTH=true
```

**Restart Typebot Engine**.

### 5. Application-Level Security (15 mins)

**NOTE**: Since Nginx configuration is not available, security is enforced at the application level:

**On Typebot Engine**:

- OIDC authentication enforces that tokens must include `subscription_status: active`
- Token validation middleware checks subscription before granting access
- Public authentication methods are disabled
- Builder access requires valid OIDC token

**Verify Security is Working**:

```bash
# Check Typebot logs for token validation
docker logs -f typebot-engine | grep -i "oidc\|token\|subscription"

# Test: Try accessing builder with invalid token (should fail)
# Test: Access via OIDC flow (should succeed)
```

**Security Model Without Nginx Rules**:

- Infrastructure: Open (anyone can access URLs)
- Application: Closed (only authenticated users with active subscription)
- This is standard for SaaS platforms where auth is at application level

### 6. Test (20 mins)

```bash
# Test direct access (should fail)
curl -I https://engine.replybase.co.uk
# Expected: 403

# Test OIDC endpoints
curl https://app.replybase.co.uk/api/oidc/.well-known/openid-configuration
# Expected: JSON config

# Test user flow
# 1. Go to app.replybase.co.uk
# 2. Register
# 3. Subscribe (use test card: 4242 4242 4242 4242)
# 4. Click "Launch Builder"
# Expected: Redirect to Typebot Engine with auto-login
```

### 7. Deploy

```bash
# In Coolify
# 1. Commit changes
# 2. Trigger deployment
# 3. Monitor logs
# 4. Verify health: curl https://app.replybase.co.uk/api/health
```

---

## 🐌 Detailed Track (First-Time Deployers)

**Follow**: [PRODUCTION_DEPLOYMENT_PLAN.md](./PRODUCTION_DEPLOYMENT_PLAN.md)

**Sections**:

- Phase 1: Environment Configuration
- Phase 2: Database Setup
- Phase 3: Typebot Configuration
- Phase 4: Infrastructure Security
- Phase 5: Testing & Validation
- Phase 6: Go Live

**Estimated Time**: 7-10 days

---

## ✅ Pre-Deployment Checklist

Before you start, ensure you have:

- [ ] SSH access: `ssh root@104.248.160.102`
- [ ] Coolify dashboard access
- [ ] PostgreSQL database URL
- [ ] Google OAuth credentials
- [ ] Facebook OAuth credentials
- [ ] Stripe account (test mode OK for now)
- [ ] Domains configured:
  - [ ] app.replybase.co.uk
  - [ ] engine.replybase.co.uk
  - [ ] bot.replybase.co.uk
- [ ] SSL certificates active

---

## 🚨 Common Issues

### Issue: "OIDC_JWKS not set" error

**Solution**: Run `node scripts/generate-jwks.js` and copy output to .env

### Issue: OIDC flow fails with "Invalid client"

**Solution**: Ensure `TYPEBOT_OIDC_CLIENT_ID` is `typebot-engine` in both SaaS and Typebot

### Issue: Can't access Typebot at all

**Solution**: Check Nginx isn't blocking OIDC callback endpoint

### Issue: Subscription check always fails

**Solution**: Run `npm run seed:stripe` to seed plans

### Issue: Direct Engine access works (should be blocked)

**Solution**: Apply Nginx rules from Phase 4

---

## 📊 Deployment Status Tracker

- [ ] **Phase 1**: Environment Configuration
  - [ ] Keys generated
  - [ ] .env configured
  - [ ] Variables set in Coolify
- [ ] **Phase 2**: Database Setup
  - [ ] Migrations run
  - [ ] Plans seeded
  - [ ] Connection verified
- [ ] **Phase 3**: Typebot Configuration
  - [ ] OIDC enabled
  - [ ] Public auth disabled
  - [ ] Engine restarted
- [ ] **Phase 4**: Infrastructure Security
  - [ ] Nginx rules applied
  - [ ] Access restrictions tested
  - [ ] Viewer configured
- [ ] **Phase 5**: Testing
  - [ ] User flow tested
  - [ ] OIDC validated
  - [ ] Security verified
- [ ] **Phase 6**: Go Live
  - [ ] Soft launch complete
  - [ ] Monitoring active
  - [ ] Public launch

---

## 🎯 Success Criteria

Your deployment is successful when:

1. ✅ User can register on `app.replybase.co.uk`
2. ✅ User can subscribe via Stripe
3. ✅ User can click "Launch Builder" and access Typebot
4. ✅ Direct access to `engine.replybase.co.uk` returns 403
5. ✅ OIDC token includes `plan` and `subscription_status` claims
6. ✅ No critical errors in logs
7. ✅ Health endpoint returns OK

---

## 📞 Need Help?

1. **Check Documentation**:
   - [PRODUCTION_DIAGNOSIS_REPORT.md](./PRODUCTION_DIAGNOSIS_REPORT.md)
   - [PRODUCTION_DEPLOYMENT_PLAN.md](./PRODUCTION_DEPLOYMENT_PLAN.md)
   - [TYPEBOT_ENGINE_CONFIGURATION.md](./TYPEBOT_ENGINE_CONFIGURATION.md)
   - [INFRASTRUCTURE_SECURITY.md](./INFRASTRUCTURE_SECURITY.md)

2. **Review Existing Guides**:
   - [PHASE1_IMPLEMENTATION_GUIDE.md](./PHASE1_IMPLEMENTATION_GUIDE.md)
   - [PHASE1_SUMMARY.md](./PHASE1_SUMMARY.md)

3. **Check Logs**:

   ```bash
   docker logs -f replybase-saas
   docker logs -f typebot-engine
   ```

4. **Common Commands**:

   ```bash
   # Check health
   curl https://app.replybase.co.uk/api/health

   # Test OIDC
   curl https://app.replybase.co.uk/api/oidc/.well-known/openid-configuration

   # Check database
   psql $DATABASE_URL -c "SELECT * FROM plans;"
   ```

---

## 🎓 Learning Resources

- **OIDC**: https://openid.net/connect/
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Production**: https://www.prisma.io/docs/guides/deployment
- **Coolify Docs**: https://coolify.io/docs
- **Typebot Docs**: https://docs.typebot.io

---

## 🔄 After Deployment

1. **Monitor for 48 hours**:
   - Check logs daily
   - Watch for errors
   - Monitor user signups

2. **Week 1 Tasks**:
   - Add error tracking (Sentry)
   - Set up uptime monitoring
   - Create backup strategy
   - Document any issues

3. **Week 2 Tasks**:
   - Optimize performance
   - Add comprehensive logging
   - Implement analytics
   - Improve documentation

---

## 🚀 Ready to Deploy?

**Start here**: [PRODUCTION_DEPLOYMENT_PLAN.md - Phase 1](./PRODUCTION_DEPLOYMENT_PLAN.md#phase-1-environment-configuration)

**Good luck! 🎉**

---

**Last Updated**: January 30, 2026  
**Version**: 1.0  
**Maintainer**: ReplyBase Team
