# Production Security Hardening - Action Checklist

## Quick Reference

Complete the remaining task to fully harden production:

---

## ✅ Task 3: PostgreSQL Security - Restrict to Localhost

**Time Required**: 5-10 minutes  
**Risk Level**: LOW (internal connections unaffected)  
**Impact**: Prevents direct PostgreSQL access from internet

### Step-by-Step:

```bash
# 1. SSH to server
ssh root@104.248.160.102

# 2. Find PostgreSQL configuration
find /data/coolify -name "docker-compose.yaml" | xargs grep -l "postgres"

# 3. Backup and edit
# Note the file path from step 2, then:
cp /path/to/postgres/docker-compose.yaml /path/to/postgres/docker-compose.yaml.backup
nano /path/to/postgres/docker-compose.yaml

# 4. Find and replace in the file:
# FIND:    - "0.0.0.0:5432:5432"
# REPLACE: - "127.0.0.1:5432:5432"

# 5. Save and exit (Ctrl+O, Enter, Ctrl+X)

# 6. Recreate container
cd /path/to/postgres
docker compose down
docker compose up -d

# 7. Verify
ss -tulpn | grep 5432
# Expected output: 127.0.0.1:5432

# 8. Test SaaS connection still works
# Note: container names change on redeploy, so list first.
docker ps --format '{{.Names}}' | grep -i replybase
# Then check logs for the SaaS container name you find above.
# Look for "Ready in" (success) or "connection refused" (failure)
docker logs -f <saas-container-name> 2>&1 | head -20
```

**Rollback (if needed)**:

```bash
cd /path/to/postgres
cp docker-compose.yaml.backup docker-compose.yaml
docker compose down && docker compose up -d
```

---

## ✅ Task 4: Engine + Viewer Access - OIDC Protected (Optional Enhancement)

**Status**: OIDC authentication already secures engine/viewer  
**Risk Level**: LOW (current setup is production-ready)  
**Impact**: Engine/viewer are publicly reachable but require SaaS authentication

**Current Security Posture**:

- ✅ OIDC authentication required for all engine access
- ✅ All other auth methods disabled (email, Google, Facebook)
- ✅ Only SaaS-authenticated users can access builder
- ✅ Viewer has no admin functionality exposed

**Optional Enhancement**: If you want to hide the login page entirely, see
[ENGINE_ACCESS_RESTRICTION_GUIDE.md](ENGINE_ACCESS_RESTRICTION_GUIDE.md) for
Cloudflare Access or other advanced options.

### Current Status:

```bash
# Engine and viewer are OIDC-protected
# Test the security:

# 1. Try direct access (you'll see a login page)
curl -I https://engine.replybase.co.uk
# Returns: HTTP 200 (login page visible)

# 2. Try to login directly (will fail - only OIDC works)
# Expected: No email/password form, only OIDC

# 3. Login via SaaS app works:
# - Go to https://app.replybase.co.uk
# - Login with your account
# - Navigate to /bots
# - Click "Launch Builder"
# - Success: Redirects to engine with OIDC authentication
```

**Security is complete** — no additional configuration needed.

---

## Verification Checklist

After completing both tasks, run these checks:

### ✅ PostgreSQL Verification

```bash
# 1. Check binding is restricted
ssh root@104.248.160.102 "ss -tulpn | grep 5432"
# Expected: 127.0.0.1:5432

# 2. Check SaaS still connects
ssh root@104.248.160.102 "docker logs ukcsgkckg4s0o4s88gk4go8g-192006684386 2>&1 | grep -i 'ready\|error' | head -3"
# Expected: "Ready in X ms" (no connection errors)

# 3. Check external access is blocked
curl -s postgresql://root:password@104.248.160.102:5432 2>&1
# Expected: Connection timeout or refused (from your local machine)
```

### ✅ Engine + Viewer Access Verification

```bash
# 1. Test OIDC protection is active
# - Login to https://app.replybase.co.uk
# - Navigate to /bots
# - Click "Open Bot Builder"
# - Should redirect and login successfully

# 3. Monitor for errors
ssh root@104.248.160.102 "docker logs -f zsw4wccwc0s88s4o0osck4k8-225113629810 2>&1" &
# Look for: "auth" or "error" keywords - should see none related to IP blocking
```

---

## Success Criteria

- ✅ PostgreSQL only listens on 127.0.0.1:5432
- ✅ SaaS app connects to PostgreSQL without errors
- ✅ Engine requires OIDC authentication (login page visible but no direct auth)
- ✅ Viewer requires OIDC authentication
- ✅ OIDC authentication flow works from the SaaS app
- ✅ All other auth methods disabled

---

## Emergency Contacts

If you get stuck:

1. **Can't SSH to server?**
   - Check network connectivity
   - Verify UFW isn't blocking port 22
   - Contact infrastructure team

2. **Made docker-compose wrong?**
   - Check the .backup file for correct format
   - Compare with other services in the file
   - See rollback procedures above

3. **PostgreSQL not connecting after changes?**
   - Verify DATABASE_URL in SaaS .env uses container name (not localhost)
   - Check container is running: `docker ps | grep postgres`
   - See rollback procedure

4. **Locked out of engine?**
   - See rollback procedure for Task 4
   - Or contact someone with allowed IP to remove middleware

---

## Performance Impact

These changes have **minimal performance impact**:

- PostgreSQL binding change: **No impact** (same network performance)
- IP whitelist: **Negligible** (< 1ms added to request time)

---

## Security Impact

After completing these tasks:

- ✅ PostgreSQL: SECURE (not exposed to internet)
- ✅ Engine: SECURE (restricted to authorized IPs)
- ✅ OIDC: SECURE (proper callback URLs, no errors)
- ✅ DEBUG: DISABLED (reduced logging overhead)
- ✅ Stripe Webhook: SECURE (public but properly authenticated)

---

## Timeline

Estimated completion: **15-25 minutes**

Recommended timing: **Off-peak hours** (when few users are accessing the system)

---

## Questions?

Refer to detailed guides:

- PostgreSQL: See [POSTGRESQL_SECURITY_FIX.md](POSTGRESQL_SECURITY_FIX.md)
- Engine Access: See [ENGINE_ACCESS_RESTRICTION_GUIDE.md](ENGINE_ACCESS_RESTRICTION_GUIDE.md)
- OIDC Flow: See [SECURITY_HARDENING_SUMMARY.md](SECURITY_HARDENING_SUMMARY.md#oidc-flow-testing)
