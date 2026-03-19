# Production Deployment Checklist (Current)

Use this checklist for every production release.

## A. Release Gate Checklist

- [ ] Scope freeze completed and change summary published.
- [ ] Staging environment parity confirmed.
- [ ] Pre-migration risk review completed.
- [ ] Rollback owner and command path confirmed.
- [ ] Monitoring dashboards and alerts active.

## B. Environment and Config

- [ ] Required auth, DB, billing, and channel env vars validated.
- [ ] OIDC and Typebot integration settings verified.
- [ ] Telegram webhook base URL is public HTTPS (`TELEGRAM_WEBHOOK_BASE_URL`).
- [ ] Token encryption key strategy verified (`TELEGRAM_TOKEN_ENCRYPTION_KEY` or `AUTH_SECRET`).

## C. Database and Migration Safety

- [ ] Backup checkpoint created and restore tested.
- [ ] Migration pre-check queries run and saved.
- [ ] Migrations applied successfully.
- [ ] Post-migration validation checks passed.

## D. Channel Smoke Test Matrix

### Facebook

- [ ] Inbound webhook event received.
- [ ] Expected flow or AI response sent.
- [ ] Conversation and message persisted.

### Telegram

- [ ] Connect or reconnect works.
- [ ] Webhook receives message events.
- [ ] Outbound send works and logs update.

### Webchat

- [ ] Session initialization works.
- [ ] Inbound message accepted and stored.
- [ ] Flow-first and AI fallback behavior validated.

## E. Post-Deploy Stabilization (24h)

- [ ] Error rate monitored for webhook endpoints.
- [ ] Outbound delivery failures and retry spikes monitored.
- [ ] 429 and 5xx trend reviewed.
- [ ] No critical regressions observed.

## F. Release Evidence (Required)

- [ ] Release id or commit hash
- [ ] Migration ids
- [ ] Smoke test result record
- [ ] Monitoring snapshot
- [ ] Final go/watch/rollback decision

Related:

- [PRODUCTION_DEPLOYMENT_PLAN.md](PRODUCTION_DEPLOYMENT_PLAN.md)
- [../Product_Details/todo/P0_Production_Deployment_Excellence.md](../Product_Details/todo/P0_Production_Deployment_Excellence.md)
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
