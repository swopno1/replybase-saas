# Production Readiness Audit & Integration Execution Report

## Replybase SaaS — app.replybase.co.uk

**Date:** 11 February 2026  
**Auditor:** Senior DevOps + Backend Lead Engineer  
**Status:** NOT READY FOR PRODUCTION

---

## EXECUTIVE SUMMARY

A comprehensive production-readiness audit was conducted on the Replybase SaaS deployment hosted on DigitalOcean at `104.248.160.102`. The infrastructure is deployed via Coolify with multiple applications (Replybase-saas, Replybase-frontend, Typebot engine, Typebot viewer) running in Docker containers managed by Traefik reverse proxy.

**Critical findings:**

- **8 BLOCKING ISSUES** prevent go-live
- **7 WARNING/PENDING items** require immediate attention
- 15 infrastructure & security components validated

---

## PHASE 0 — INITIAL CONNECTION & SYSTEM SNAPSHOT

### Infrastructure Snapshot

| Component         | Result                                        |
| ----------------- | --------------------------------------------- |
| **OS**            | Ubuntu 24.04.3 LTS (Kernel: 6.8.0-90-generic) |
| **Node.js**       | v20.19.6                                      |
| **Docker**        | 29.1.3                                        |
| **Reverse Proxy** | Coolify Traefik v3.6                          |
| **PM2**           | Not installed                                 |
| **Fail2ban**      | Running (active)                              |
| **UFW**           | Active (deny incoming by default)             |

### Running Services & Ports

| Service                   | Type   | Status | Port(s)                              |
| ------------------------- | ------ | ------ | ------------------------------------ |
| coolify-sentinel          | Docker | Up 15h | health check                         |
| coolify-proxy (Traefik)   | Docker | Up 2w  | 80/443 (http/https), 8080, 6001-6002 |
| coolify (core)            | Docker | Up 2w  | 8000 (management UI)                 |
| coolify-db                | Docker | Up 3w  | 5432 (internal)                      |
| coolify-redis             | Docker | Up 3w  | 6379 (internal)                      |
| coolify-realtime          | Docker | Up 3w  | 6001-6002 (WebSocket)                |
| **replybase-saas**        | Docker | Up 12d | 3000 (internal) → 443 (external)     |
| **replybase-frontend**    | Docker | Up 12d | 3000 (internal) → 443 (external)     |
| **bot-builder (typebot)** | Docker | Up 2w  | 3000 (internal) → 443 (external)     |
| **bot-viewer (typebot)**  | Docker | Up 2w  | 3000 (internal) → 443 (external)     |
| **PostgreSQL**            | Docker | Up 2w  | 5432 (exposed)                       |

### Network Configuration

| Rule            | Status                       |
| --------------- | ---------------------------- |
| SSH (22/tcp)    | ALLOW from anywhere          |
| HTTP (80/tcp)   | ALLOW from anywhere          |
| HTTPS (443/tcp) | ALLOW from anywhere          |
| Local port 3001 | ALLOW from 127.0.0.1 only    |
| Redundant rules | Multiple duplicates detected |

---

## PHASE 1 — APPLICATION STRUCTURE VALIDATION

### Coolify Applications Overview

| Name                  | Domain                               | Status | Latest Deploy | Container Image                     |
| --------------------- | ------------------------------------ | ------ | ------------- | ----------------------------------- |
| Replybase-Frontend    | replybase.co.uk, www.replybase.co.uk | Up 12d | 30 Jan 2026   | Custom build: a353cab7              |
| Replybase-saas        | app.replybase.co.uk                  | Up 12d | 30 Jan 2026   | Custom build: 828ea5a5              |
| bot-builder (Typebot) | engine.replybase.co.uk               | Up 2w  | 29 Jan 2026   | baptistearno/typebot-builder:latest |
| bot-viewer (Typebot)  | bot.replybase.co.uk                  | Up 2w  | 25 Jan 2026   | baptistearno/typebot-viewer:latest  |

### Test Log: Build & Runtime Status

| Test # | Test Name                  | Expected Result                        | Actual Result                                                                                   | Status   |
| ------ | -------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| 1      | SaaS build (npm run build) | Build completes without errors         | **FAILED** — Missing Prisma runtime: `query_compiler_bg.postgresql.wasm-base64.js`              | **FAIL** |
| 2      | SaaS start (npm run start) | App starts on port 3000 without errors | Started successfully on port 3001; terminated by timeout (no errors during startup)             | **PASS** |
| 3      | Prisma migrations          | All migrations applied, no pending     | `No pending migrations to apply`                                                                | **PASS** |
| 4      | Runtime logs (SaaS)        | No recurring errors                    | Repeated: "Failed to find Server Action x" — indicates stale build cache or deployment mismatch | **FAIL** |
| 5      | Runtime logs (Viewer)      | No auth/runtime errors                 | Repeated: "Failed to find Server Action x"                                                      | **FAIL** |
| 6      | Runtime logs (Builder)     | OIDC callback working                  | `[auth][error] UnknownAction: Cannot parse action at /api/auth/oauth/generic-oidc/callback`     | **FAIL** |

**Critical Finding:**
The repeated "Failed to find Server Action" errors indicate a Next.js deployment issue where the client-side request references a server action that does not exist in the current build. This typically occurs when:

1. Build artifacts (.next) are stale or corrupt
2. Client and server are out of sync
3. Server action IDs have changed but old cache persists

---

## PHASE 2 — DATABASE VALIDATION (PostgreSQL)

### Database Connectivity

| Test # | Test Name               | Expected                                              | Actual                                                                | Status   |
| ------ | ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| 1      | DB connectivity (psql)  | Connection succeeds                                   | Connected to `replybase_saas` successfully                            | **PASS** |
| 2      | Schema integrity        | Core tables exist                                     | All 55 tables present                                                 | **PASS** |
| 3      | Critical tables present | users, accounts, sessions, subscriptions, bots, flows | users ✓, accounts ✓, sessions ✓, subscriptions ✓, bots ✓, **flows ✗** | **FAIL** |

### Table List (55 total)

**Core Authentication & User Management:**

- users, accounts (NextAuth)
- sessions (NextAuth)
- verificationtokens

**Replybase Business Logic:**

- subscriptions, plans
- bots, channels, contacts, contact_identities
- facebook_pages
- crm_conversations, crm_messages
- leads, newsletter_subscribers
- execution_logs, internal_notes
- usage_logs, system_health

**Typebot Entities:**

- Typebot, Workspace, MemberInWorkspace
- Answer, AnswerV2, Result, ChatSession
- PublicTypebot, CollaboratorsOnTypebots
- Webhook, CustomDomain, Credentials, ApiToken

**Missing:**

- ❌ `flows` table (referenced in schema but not present)
- ⚠️ Schema inconsistency suggests incomplete migration

### Subscriptions Schema

```sql
Table "public.subscriptions"
  Column              | Type              | Nullable | Notes
  ─────────────────────────────────────────────────────────
  id                  | text              | NOT NULL | Primary key
  stripeId            | text              | NOT NULL | Stripe subscription ID
  stripeCustomerId    | text              |          | Stripe customer reference
  status              | text              | NOT NULL | active/cancelled/suspended
  currentPeriodStart  | timestamp         | NOT NULL | Billing period start
  currentPeriodEnd    | timestamp         | NOT NULL | Billing period end
  cancelAtPeriodEnd   | boolean           | NOT NULL | Cancellation flag
  trialEndsAt         | timestamp         |          | Trial end (nullable)
  planId              | text              | NOT NULL | Foreign key → plans
  tenantId            | text              | NOT NULL | Foreign key → tenants
  createdAt           | timestamp         | NOT NULL |
  updatedAt           | timestamp         | NOT NULL |

Indexes:
  - subscriptions_pkey (PRIMARY KEY on id)
  - subscriptions_stripeCustomerId_key (UNIQUE)
  - subscriptions_stripeId_key (UNIQUE)
  - subscriptions_tenantId_key (UNIQUE)
```

**Assessment:** Stripe schema is properly configured. All required fields present for subscription lifecycle tracking.

---

## PHASE 3 — AUTHENTICATION SYSTEM VALIDATION

### Test Log: Auth Configuration

| Test # | Test Name                    | Expected                             | Actual                                     | Status      |
| ------ | ---------------------------- | ------------------------------------ | ------------------------------------------ | ----------- |
| 1      | Providers endpoint           | Google, Facebook, Credentials listed | All three returned                         | **PASS**    |
| 2      | AUTH_SECRET configured       | Environment variable set             | Set (value redacted)                       | **PASS**    |
| 3      | NEXTAUTH_URL configured      | URL set to production domain         | `https://app.replybase.co.uk`              | **PASS**    |
| 4      | HTTPS enforced               | HTTP redirects to HTTPS              | HTTP 307 → HTTPS ✓                         | **PASS**    |
| 5      | Live Google login            | OAuth flow completes                 | Not executed (pending manual approval)     | **WARNING** |
| 6      | Live Facebook login          | OAuth flow completes                 | Not executed (pending manual approval)     | **WARNING** |
| 7      | Email/password flow          | Credentials auth works               | Not executed (pending manual approval)     | **WARNING** |
| 8      | Session persistence          | Session stays after page reload      | Not executed (pending manual approval)     | **WARNING** |
| 9      | Logout functionality         | Session destroyed                    | Not executed (pending manual approval)     | **WARNING** |
| 10     | Cookie security (production) | Secure flag, SameSite set            | Not verified (requires browser inspection) | **WARNING** |

### Auth Providers Detected

```json
{
  "facebook": {
    "id": "facebook",
    "name": "Facebook",
    "signinUrl": "https://app.replybase.co.uk/api/auth/signin/facebook",
    "callbackUrl": "https://app.replybase.co.uk/api/auth/callback/facebook"
  },
  "google": {
    "id": "google",
    "name": "Google",
    "signinUrl": "https://app.replybase.co.uk/api/auth/signin/google",
    "callbackUrl": "https://app.replybase.co.uk/api/auth/callback/google"
  },
  "credentials": {
    "id": "credentials",
    "name": "Credentials",
    "signinUrl": "https://app.replybase.co.uk/api/auth/signin/credentials",
    "callbackUrl": "https://app.replybase.co.uk/api/auth/callback/credentials"
  }
}
```

---

## PHASE 4 — STRIPE PRODUCTION CHECK

### Environment Verification

| Variable                 | Status | Notes                                  |
| ------------------------ | ------ | -------------------------------------- |
| `STRIPE_SECRET_KEY`      | ✓ SET  | Live key detected (sk*live*...)        |
| `STRIPE_PUBLISHABLE_KEY` | ✓ SET  | Live key detected (pk*live*...)        |
| `STRIPE_WEBHOOK_SECRET`  | ✓ SET  | Webhook secret configured (whsec\_...) |

### Test Log: Stripe Integration

| Test # | Test Name                      | Expected                              | Actual                             | Status      |
| ------ | ------------------------------ | ------------------------------------- | ---------------------------------- | ----------- |
| 1      | Live keys in use               | Stripe live mode active               | Live prefixes detected             | **PASS**    |
| 2      | Webhook endpoint accessible    | `/api/stripe/webhook` returns 200/400 | **307 redirect to login** ❌       | **FAIL**    |
| 3      | Webhook signature verification | HMAC validation active                | Not tested (endpoint protected)    | **WARNING** |
| 4      | Subscription created event     | Event webhook received                | Not tested (pending live approval) | **WARNING** |
| 5      | Payment succeeded event        | Event webhook received                | Not tested (pending live approval) | **WARNING** |
| 6      | Payment failed event           | Error handling active                 | Not tested (pending live approval) | **WARNING** |
| 7      | Subscription cancelled event   | Cancellation handled                  | Not tested (pending live approval) | **WARNING** |

**Critical Issue:**
The Stripe webhook endpoint (`/api/stripe/webhook`) is protected by NextAuth authentication. Stripe cannot authenticate to this endpoint and will fail to deliver webhook events. **This must be fixed before going live.**

```
Actual request:
  GET https://app.replybase.co.uk/api/stripe/webhook

Response:
  HTTP/2 307
  Location: /auth/login?callbackUrl=%2Fapi%2Fstripe%2Fwebhook
```

---

## PHASE 5 — ENGINE (TYPEBOT) CONNECTIVITY

### Architecture Validation

```
User → SaaS (app.replybase.co.uk)
  ↓ (AI_ENGINE_URL)
Engine (engine.replybase.co.uk)
  ↓ (NEXT_PUBLIC_VIEWER_URL)
Viewer (bot.replybase.co.uk)
  ↓ (embed on SaaS)
Back to SaaS
```

### Test Log: Engine Access

| Test # | Test Name                  | Expected                  | Actual                              | Status      |
| ------ | -------------------------- | ------------------------- | ----------------------------------- | ----------- |
| 1      | Engine publicly browsable  | Engine hidden from public | Returns 307 to /signin (accessible) | **FAIL**    |
| 2      | Engine login page exposed  | Direct login not exposed  | Signin page accessible at root      | **FAIL**    |
| 3      | Protected by reverse proxy | Firewall/auth required    | Only NextAuth auth present          | **FAIL**    |
| 4      | SaaS → Engine connectivity | HTTPS reachable           | 307 response (auth required)        | **PASS**    |
| 5      | Authenticated API calls    | Bot creation succeeds     | Not tested (needs valid token)      | **WARNING** |
| 6      | Flow retrieval             | Get bot flows             | Not tested (needs valid token)      | **WARNING** |

**Engine Access Response:**

```
Endpoint: https://engine.replybase.co.uk
Status: 307 Temporary Redirect
Location: /signin
Headers:
  - x-frame-options: SAMEORIGIN
  - x-content-type-options: nosniff
  - content-security-policy: default-src 'self'; ...
```

**Assessment:** Engine is publicly accessible with signin page exposed. While NextAuth provides some protection, the engine should ideally be restricted via network firewall (not accessible from internet directly).

---

## PHASE 6 — VIEWER CONNECTIVITY

### Test Log: Viewer Integration

| Test # | Test Name                   | Expected                        | Actual                                     | Status      |
| ------ | --------------------------- | ------------------------------- | ------------------------------------------ | ----------- |
| 1      | Viewer domain active        | HTTPS 200 OK                    | 200 OK ✓                                   | **PASS**    |
| 2      | HTTPS enforced              | All traffic encrypted           | ✓                                          | **PASS**    |
| 3      | Mixed content issues        | No insecure resource loads      | Not audited (needs browser test)           | **WARNING** |
| 4      | CORS configured             | Cross-origin requests allowed   | No CORS headers detected (same-site only?) | **WARNING** |
| 5      | Embed in dashboard          | Bot renders in SaaS             | Not tested (needs UI test)                 | **WARNING** |
| 6      | Live bot message submission | Messages submitted successfully | Not tested (needs UI test)                 | **WARNING** |

**Viewer Response Headers:**

```
HTTP/2 200 OK
Content-Type: text/html; charset=utf-8
X-Powered-By: Next.js
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
ETag: "hcu68z3d401hq"
```

**CORS Assessment:** No Access-Control-\* headers detected. If viewer is embedded via iframe, CORS may not be required. If API calls are made from SaaS to viewer, CORS must be configured.

---

## PHASE 7 — META (FACEBOOK) LIVE TEST

### Test Status: PENDING APPROVAL

| Component            | Status       | Notes                                           |
| -------------------- | ------------ | ----------------------------------------------- |
| Facebook App ID      | ✓ Configured | Value: `1380730836883364`                       |
| Facebook App Secret  | ✓ Configured | Set (value redacted)                            |
| Webhook Verify Token | ✓ Configured | `replybase_webhook_verify_2026_secure_token_fb` |
| Callback URL         | ✓ Configured | Not directly visible; likely webhook endpoint   |
| Required permissions | ? Pending    | Needs Meta dashboard verification               |

### Test Plan (Awaiting Approval)

1. Verify Facebook app configuration in Meta developer portal
2. Confirm webhook URL and verify token
3. Connect real Facebook page to Replybase
4. Send test message to page
5. Verify webhook is triggered
6. Confirm bot response is delivered

**Note:** No workflow engine (n8n) container detected. Verify message handling path.

---

## PHASE 8 — MAIN SYSTEM FLOW & WORKFLOWS

### Test Status: PENDING VERIFICATION

| Check                    | Status       | Notes                            |
| ------------------------ | ------------ | -------------------------------- |
| Workflow engine running  | ❌ NOT FOUND | No n8n or similar detected       |
| Active workflows         | ? Unknown    | No workflow dashboard accessible |
| Facebook page connection | ? Untested   | Needs manual verification        |
| Hardcoded localhost refs | ? Untested   | Code review required             |
| Production URLs used     | ? Likely OK  | All env vars use production URLs |

---

## PHASE 9 — SECURITY HARDENING

### Firewall Status

```
UFW Status: Active

Rules (Input):
  22/tcp (OpenSSH)           ALLOW IN from Anywhere
  80,443/tcp (Nginx Full)    ALLOW IN from Anywhere
  3001 (Custom)              ALLOW IN from 127.0.0.1

Issues:
  ❌ Redundant rules detected (duplicate allow 22, 80, 443)
  ⚠️  IPv6 and IPv4 duplicates present
  ✓  Default policy: DENY incoming (secure)
```

### Security Assessment

| Component            | Status      | Finding                                                    |
| -------------------- | ----------- | ---------------------------------------------------------- |
| **SSH Port**         | OPEN (22)   | Default port; consider changing to non-standard (optional) |
| **HTTP**             | ALLOW (80)  | Properly redirects to HTTPS ✓                              |
| **HTTPS**            | ALLOW (443) | ✓                                                          |
| **PostgreSQL**       | 🔴 EXPOSED  | Listening on 0.0.0.0:5432 via docker-proxy                 |
| **Fail2ban**         | ✓ RUNNING   | Active; protects against brute force                       |
| **.env Exposure**    | ✓ PROTECTED | /.env returns 404                                          |
| **Debug Logs**       | 🔴 ENABLED  | DEBUG=true in bot-builder (production env)                 |
| **Console Logging**  | ? UNTESTED  | Requires code review                                       |
| **HSTS Header**      | ❌ MISSING  | No Strict-Transport-Security header detected               |
| **Security Headers** | ⚠️ PARTIAL  | CSP present in engine; missing others                      |

### Test Log: Security

| Test # | Test Name                 | Expected                         | Actual                        | Status      |
| ------ | ------------------------- | -------------------------------- | ----------------------------- | ----------- |
| 1      | UFW active                | Firewall enabled                 | Status: active ✓              | **PASS**    |
| 2      | Only required ports open  | 22, 80, 443                      | ✓ (with redundancy)           | **PASS**    |
| 3      | Default SSH port          | Consider hardening (optional)    | Port 22 open                  | **WARNING** |
| 4      | Fail2ban installed        | DDoS/brute-force protection      | Running ✓                     | **PASS**    |
| 5      | .env not accessible       | Returns 403/404                  | 404 ✓                         | **PASS**    |
| 6      | Debug logs disabled       | DEBUG=false in production        | **DEBUG=true in bot-builder** | **FAIL**    |
| 7      | Postgres not exposed      | DB accessible only internally    | **Listening on 0.0.0.0:5432** | **FAIL**    |
| 8      | HSTS enabled              | Strict-Transport-Security header | Not detected                  | **FAIL**    |
| 9      | Security headers complete | CSP, X-Frame-Options, etc.       | Partial (present in engine)   | **WARNING** |

**Critical Security Issue: PostgreSQL Exposure**

```bash
ss -tulpn | grep 5432
tcp  LISTEN  0.0.0.0:5432  0.0.0.0:*  (docker-proxy)
```

PostgreSQL is listening on all interfaces (0.0.0.0). If an attacker gains external access to port 5432, they can attempt DB connections. While Docker isolation provides some protection, this should be restricted to 127.0.0.1.

---

## PHASE 10 — PERFORMANCE & STABILITY

### System Resources

```
Uptime:        33 days 5 hours 34 minutes
Load Average:  0.20, 0.29, 0.26 (low)
CPU Usage:     8.6% us + 8.6% sy = ~17% total (healthy)
Idle:          91.3%

Memory:
  Total:       3.8 GiB
  Used:        1.9 GiB (50%)
  Free:        436 MiB (11%)
  Buffered:    1.9 GiB
  Available:   1.9 GiB
  Swap Used:   1.0 GiB / 2.0 GiB (50% swap in use) ⚠️

Disk:
  Total:       116 GiB
  Used:        27 GiB (23%)
  Available:   89 GiB
  Status:      Healthy
```

### Test Log: Performance

| Test # | Test Name               | Expected                         | Actual                             | Status      |
| ------ | ----------------------- | -------------------------------- | ---------------------------------- | ----------- |
| 1      | Server memory usage     | <70% RAM + <30% swap             | 50% RAM + 50% swap                 | **WARNING** |
| 2      | CPU load                | <50% sustained                   | ~17% avg (healthy)                 | **PASS**    |
| 3      | Node memory leaks       | No memory growth over time       | Not tested (needs 24h observation) | **WARNING** |
| 4      | Large bot flow test     | No timeouts                      | Not tested                         | **WARNING** |
| 5      | Concurrent message test | Handle 10+ simultaneous requests | Not tested                         | **WARNING** |
| 6      | Disk capacity           | Sufficient free space            | 89 GiB free (good)                 | **PASS**    |
| 7      | Container restarts      | No unexpected restarts           | Not verified (check logs)          | **WARNING** |

**Assessment:**

- CPU: Healthy (17% utilized)
- Memory: Adequate but swap usage (50%) is elevated; suggests memory pressure
- Disk: Good (23% utilized with 89 GiB free)

---

## BLOCKING ISSUES (MUST FIX)

### 🔴 Issue 1: Prisma Runtime Missing (Build Failure)

**Severity:** CRITICAL  
**Component:** Replybase-saas  
**Error:** `Cannot find module '/app/node_modules/@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.js'`  
**Impact:** Production build fails; app cannot be rebuilt.

**Root Cause:** Incomplete npm installation or corrupted node_modules.

**Resolution:**

1. Rebuild Replybase-saas Docker image
2. Ensure `npm ci` is used (not `npm install`) in Dockerfile
3. Verify Prisma postinstall script runs

---

### 🔴 Issue 2: "Failed to find Server Action" Errors

**Severity:** CRITICAL  
**Component:** Replybase-saas, bot-viewer  
**Error:** Repeated in logs: `Error: Failed to find Server Action "x"...`  
**Impact:** App may fail to handle user requests; unpredictable behavior.

**Root Cause:** Server actions compiled into old build but client expects different action IDs. Likely caused by stale .next cache or incomplete build.

**Resolution:**

1. Clear .next directory in containers
2. Rebuild and redeploy all Next.js apps
3. Verify client/server action signatures match

---

### 🔴 Issue 3: Stripe Webhook Behind Auth

**Severity:** CRITICAL  
**Component:** /api/stripe/webhook  
**Issue:** Endpoint requires NextAuth authentication; Stripe cannot deliver webhooks.  
**Impact:** Stripe events (payment failed, subscription cancelled, etc.) will not be processed. Billing will break.

**Resolution:**

```typescript
// Make webhook endpoint public (bypass auth)
// Mark route handler with: skipAuth = true or similar
```

---

### 🔴 Issue 4: Typebot Builder Auth Error

**Severity:** CRITICAL  
**Component:** bot-builder (engine)  
**Error:** `[auth][error] UnknownAction: Cannot parse action at /api/auth/oauth/generic-oidc/callback`  
**Impact:** OIDC authentication broken; users cannot log into engine.

**Root Cause:** OIDC callback route handler not properly defined or server action not found.

**Resolution:**

1. Verify /api/auth/[...nextauth]/route.ts exists in builder app
2. Ensure OIDC provider is properly configured
3. Check callback URL matches Replybase-saas OIDC issuer

---

### 🔴 Issue 5: `flows` Table Missing

**Severity:** CRITICAL  
**Component:** Database schema  
**Issue:** Table referenced but does not exist in PostgreSQL.  
**Impact:** Any code querying `flows` will fail with relation not found error.

**Resolution:**

1. Check if `flows` should exist (review Prisma schema)
2. If yes, run missing migration: `prisma migrate dev`
3. If no, remove references to `flows` from code

---

### 🔴 Issue 6: DEBUG=true in Production

**Severity:** HIGH  
**Component:** bot-builder environment  
**Issue:** `DEBUG=true` in production environment exposes sensitive logs.  
**Impact:** Memory usage, performance impact; security risk if logs expose API keys or user data.

**Resolution:**

```bash
# Update bot-builder environment variable
DEBUG=false
```

---

### 🔴 Issue 7: PostgreSQL Listening on 0.0.0.0

**Severity:** HIGH  
**Component:** Docker PostgreSQL service  
**Issue:** Port 5432 exposed on all interfaces (0.0.0.0:5432).  
**Impact:** If firewall is bypassed, attacker can attempt DB connection.

**Resolution:**

```bash
# Restrict to localhost only
# Update docker-compose or proxy configuration to bind 127.0.0.1:5432
```

---

### 🔴 Issue 8: Engine Publicly Accessible

**Severity:** MEDIUM  
**Component:** engine.replybase.co.uk  
**Issue:** Engine accessible from public internet; signin page exposed.  
**Impact:** While auth-protected, engine should be internal-only or IP-restricted.

**Resolution:**

1. Option A: Restrict engine domain to VPN/internal network
2. Option B: Add IP whitelist to reverse proxy
3. Option C: Use private DNS (not public)

---

## WARNING / PENDING ITEMS

| #   | Item                                  | Status  | Action Required                   |
| --- | ------------------------------------- | ------- | --------------------------------- |
| 1   | Live Google login test                | PENDING | Manual approval + execution       |
| 2   | Live Facebook login test              | PENDING | Manual approval + execution       |
| 3   | Email/password auth flow              | PENDING | Manual approval + execution       |
| 4   | Session persistence & logout          | PENDING | Manual approval + execution       |
| 5   | Stripe webhook signature verification | PENDING | Must fix webhook auth first       |
| 6   | Live subscription creation flow       | PENDING | Stripe approval + manual test     |
| 7   | Facebook page connection end-to-end   | PENDING | Meta dashboard access required    |
| 8   | Workflow engine verification          | PENDING | Identify workflow system          |
| 9   | Large bot flow load test              | PENDING | Performance test needed           |
| 10  | Concurrent message throughput test    | PENDING | Load test needed                  |
| 11  | HSTS header configuration             | PENDING | Add to Traefik/app                |
| 12  | Security headers audit                | PENDING | Complete CSP/X-Frame-Options/etc. |
| 13  | Memory leak monitoring                | PENDING | 24-hour memory profile            |
| 14  | Container restart logs                | PENDING | Verify no unexpected restarts     |

---

## PASS / FAIL SUMMARY

### ✅ PASS (15 items)

- [x] OS/Node/Docker versions confirmed
- [x] Infrastructure reachable (SSH, HTTP/HTTPS)
- [x] UFW firewall active with proper rules
- [x] DB connectivity verified
- [x] Core tables present (users, accounts, sessions, subscriptions, bots)
- [x] Subscriptions schema correct (Stripe fields present)
- [x] AUTH_SECRET configured
- [x] NEXTAUTH_URL set correctly
- [x] HTTPS enforced (HTTP → HTTPS redirect)
- [x] Auth providers registered (Google, Facebook, Credentials)
- [x] Stripe live keys in use
- [x] Viewer domain reachable (200 OK)
- [x] .env not publicly accessible
- [x] Fail2ban running
- [x] Disk space adequate (23% used, 89 GiB free)
- [x] CPU healthy (17% avg)

### ❌ FAIL (8 items)

- [ ] SaaS production build passes (missing Prisma runtime)
- [ ] "Failed to find Server Action" errors resolved (SaaS + viewer)
- [ ] Typebot builder OIDC callback working
- [ ] Stripe webhook endpoint public (currently 307 → login)
- [ ] `flows` table present in database
- [ ] DEBUG disabled in production (bot-builder has DEBUG=true)
- [ ] PostgreSQL restricted to 127.0.0.1 (currently 0.0.0.0:5432)
- [ ] Engine not publicly browsable (currently accessible with signin)

### ⚠️ WARNING / PENDING (7 items)

- [ ] Live Google/Facebook OAuth flows (need manual test)
- [ ] Email/password authentication (need manual test)
- [ ] Session persistence & logout behavior
- [ ] Stripe webhook signature verification (blocked by auth issue)
- [ ] Live subscription lifecycle (blocked by webhook issue)
- [ ] Facebook end-to-end message flow (needs Meta dashboard access)
- [ ] Workflow engine identified and verified
- [ ] Memory swap usage elevated (50%) — monitor for leaks
- [ ] HSTS header missing
- [ ] Security headers incomplete
- [ ] Large flow / concurrent load tests
- [ ] Container restart history

---

## GO-LIVE READINESS STATUS

### 🔴 NOT READY FOR PRODUCTION

**Current Status:** 15 PASS / 8 FAIL / 7 WARNING  
**Blockers:** 8 Critical/High issues must be resolved  
**Estimated time to fix:** 2-3 hours with proper approvals

### Timeline to Production

**Before Fixes (TODAY):**

- ❌ Cannot deploy (build fails, webhooks broken, auth errors)

**After Fixing 8 Blockers (~2-3 hours):**

- Prisma runtime resolved
- Server action errors fixed
- Stripe webhook made public
- Builder OIDC configured
- Flows table added/validated
- DEBUG disabled
- Postgres restricted
- Engine access hardened

**Then (1-2 hours):**

- Live Google/Facebook auth tests
- Stripe subscription flow test
- Facebook end-to-end test
- Load tests

**Final (30 min):**

- Performance review
- Security headers audit
- Sign-off checklist

**Estimated Go-Live:** Feb 11, 2026 evening (pending fixes + testing)

---

## BLOCKING ISSUES RESOLUTION CHECKLIST

### Priority 1: Deployment & Build Failures

- [ ] **Prisma Runtime Missing**
  - [ ] Rebuild Replybase-saas Docker image
  - [ ] Use `npm ci` instead of `npm install`
  - [ ] Run `npm run build` locally to verify
  - [ ] Redeploy via Coolify
  - [ ] Verify container starts without errors
  - **Estimated:** 30 min

- [ ] **"Failed to find Server Action" Errors**
  - [ ] Clear `.next` cache in all Next.js containers
  - [ ] Rebuild all three apps (saas, frontend, viewer)
  - [ ] Verify server action IDs match between client and server
  - [ ] Check for stale cache in browser/CDN
  - **Estimated:** 45 min

### Priority 2: API & Webhook Failures

- [ ] **Stripe Webhook Behind Auth**
  - [ ] Modify `/api/stripe/webhook` to bypass NextAuth
  - [ ] Verify Stripe can POST to webhook endpoint (test webhook from dashboard)
  - [ ] Confirm webhook signature verification works
  - **Estimated:** 20 min

- [ ] **Typebot Builder OIDC Callback Error**
  - [ ] Verify OIDC client ID and secret in builder env
  - [ ] Check callback URL: `https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback`
  - [ ] Verify Replybase-saas OIDC issuer is reachable: `https://app.replybase.co.uk/api/oidc`
  - [ ] Test OIDC flow end-to-end
  - **Estimated:** 30 min

### Priority 3: Database & Schema

- [ ] **Missing `flows` Table**
  - [ ] Review Prisma schema for flows definition
  - [ ] Check if migration file exists
  - [ ] Run `prisma migrate deploy` if needed
  - [ ] Verify table created: `\d flows` in psql
  - **Estimated:** 15 min

### Priority 4: Security Hardening

- [ ] **DEBUG=true in Production**
  - [ ] Edit bot-builder environment in Coolify
  - [ ] Set `DEBUG=false`
  - [ ] Restart container
  - **Estimated:** 5 min

- [ ] **PostgreSQL Exposed on 0.0.0.0**
  - [ ] Modify docker-compose or proxy config
  - [ ] Bind PostgreSQL to 127.0.0.1 only
  - [ ] Restart postgres container
  - [ ] Verify: `ss -tulpn | grep 5432` shows 127.0.0.1
  - **Estimated:** 15 min

- [ ] **Engine Publicly Accessible**
  - [ ] Evaluate: Keep as-is, restrict to VPN, or IP-whitelist
  - [ ] If restricting, update Traefik middleware
  - [ ] Test access from outside network
  - **Estimated:** 20 min (if changes needed)

---

## LIVE TESTING PLAN (Pending Approval)

### Phase A: Authentication (1 hour)

```
Test A1: Google OAuth Flow
├─ Navigate to app.replybase.co.uk
├─ Click "Sign in with Google"
├─ Authorize as test user
├─ Verify login successful
├─ Check session created
└─ Logout and verify session cleared

Test A2: Facebook OAuth Flow
├─ Navigate to app.replybase.co.uk
├─ Click "Sign in with Facebook"
├─ Authorize as test user
├─ Verify login successful
├─ Check session created
└─ Logout and verify session cleared

Test A3: Email/Password Flow
├─ Navigate to app.replybase.co.uk
├─ Create new account (email + password)
├─ Verify email confirmation (if enabled)
├─ Login with credentials
└─ Verify session created

Test A4: Session Persistence
├─ Login as test user
├─ Refresh page → session persists
├─ Close browser → login again
├─ Use device token for auto-login (if enabled)
```

### Phase B: Stripe Subscription (1.5 hours)

```
Test B1: Stripe Live Mode Verification
├─ Confirm STRIPE_SECRET_KEY uses sk_live_*
├─ Confirm webhook secret configured
├─ Verify webhook endpoint 200 response
└─ Test webhook delivery from Stripe dashboard

Test B2: Subscription Creation Flow
├─ Login as test user
├─ Navigate to billing/upgrade
├─ Select plan (Starter/Pro/Business)
├─ Verify Stripe checkout page loads
├─ Complete payment with test card
├─ Verify subscription created in DB
└─ Confirm user tier updated

Test B3: Payment Events
├─ Trigger "payment_failed" event from Stripe dashboard
├─ Verify app handles failure gracefully
├─ Trigger "subscription_cancelled" event
├─ Verify subscription status updated
└─ Check user access downgraded

Test B4: Subscription Lifecycle
├─ Verify renewal email sent before period end
├─ Test subscription cancellation
├─ Verify cancellation effective date
└─ Check user access downgraded after cancellation
```

### Phase C: Facebook Integration (2 hours)

```
Test C1: Facebook App Configuration
├─ Verify App ID in Meta dashboard matches env var
├─ Verify App Secret correct
├─ Verify webhook URL and verify token
└─ Confirm required permissions approved

Test C2: Connect Facebook Page
├─ Login to app.replybase.co.uk as test user
├─ Navigate to integrations/Facebook
├─ Authorize connection to test FB page
├─ Verify page connected in DB
└─ Confirm webhook subscribed

Test C3: Send Test Message
├─ Open test Facebook page in browser
├─ Create test post/conversation
├─ Send test message to page
├─ Verify webhook triggered in logs
└─ Confirm message stored in DB

Test C4: Bot Reply
├─ Verify bot flow assigned to page
├─ Send another test message
├─ Verify bot detects message
├─ Confirm bot generates reply
├─ Verify reply posted to Facebook page
└─ Check conversation recorded in CRM
```

### Phase D: End-to-End Scenario (1 hour)

```
Test D1: Complete User Signup → Subscribe → Connect → Message Flow

Step 1: Signup
  ├─ User navigates to app.replybase.co.uk
  ├─ Creates account (Google or email)
  └─ Onboarded to dashboard

Step 2: Subscribe
  ├─ User upgrades to Pro plan
  ├─ Completes Stripe payment
  └─ Subscription created in DB

Step 3: Connect Facebook
  ├─ User authorizes FB page connection
  ├─ Page added to workspace
  └─ Bot assigned to page

Step 4: Create Bot Flow
  ├─ User creates new bot in builder (engine)
  ├─ Defines conversation flow
  └─ Publishes bot

Step 5: Send Message
  ├─ Send test message to FB page
  ├─ Webhook triggered
  ├─ Bot processes flow
  └─ Bot replies to user

Step 6: View in Dashboard
  ├─ User logs into app.replybase.co.uk
  ├─ Views conversation in CRM
  ├─ Sees message + bot response
  └─ Can reply directly from dashboard

Result: ✅ PASS / ❌ FAIL + log errors
```

---

## RECOMMENDATIONS FOR LONG-TERM PRODUCTION READINESS

### Immediate (Before Go-Live)

1. **Fix all 8 blocking issues** (2-3 hours)
2. **Execute Phase A-D testing** (4-5 hours)
3. **Add missing security headers** (HSTS, X-Frame-Options, etc.)
4. **Implement load testing** (verify 10+ concurrent users)
5. **Set up monitoring and alerting**
   - Container health checks
   - Memory leak detection
   - API latency tracking
   - Stripe webhook monitoring

### Short-Term (Week 1 Post-Launch)

1. **Enable comprehensive logging**
   - Structured JSON logs to centralized service (e.g., Datadog, ELK)
   - Correlation IDs for request tracing
   - Performance metrics (response times, error rates)

2. **Implement backup & disaster recovery**
   - Daily automated DB backups
   - Point-in-time recovery tested
   - RTO/RPO targets defined

3. **Security hardening**
   - Move engine to private network or VPN
   - Implement rate limiting on API endpoints
   - Add DDoS protection (Cloudflare or similar)
   - Regular security audits

### Medium-Term (Month 1)

1. **Performance optimization**
   - Database query profiling
   - Caching strategy (Redis)
   - CDN for static assets (Cloudflare)
   - Image optimization

2. **Operational excellence**
   - Automated deployments (CI/CD pipeline)
   - Blue-green deployments
   - Canary releases for testing
   - Runbooks for common incidents

3. **Observability**
   - APM (Application Performance Monitoring)
   - Error tracking (Sentry)
   - Uptime monitoring (StatusPage)
   - SLA tracking

---

## AUDIT NOTES & OBSERVATIONS

### Strengths

✅ Modern infrastructure (Ubuntu 24.04, Node 20, Docker 29)  
✅ Proper use of containerization and reverse proxy (Traefik)  
✅ NextAuth configured for multi-provider auth  
✅ Stripe integration partially set up (keys, DB schema ready)  
✅ HTTPS enforced across all domains  
✅ Fail2ban protecting against brute force  
✅ Database migrations applied  
✅ Good uptime (33 days)  
✅ Adequate disk space and CPU headroom

### Weaknesses

❌ Build system has unresolved dependency issue  
❌ Next.js server actions sync problem  
❌ Critical Stripe webhook authentication blocking  
❌ Typebot builder auth broken  
❌ Database schema incomplete (missing flows table)  
❌ Debug logs enabled in production  
❌ PostgreSQL exposed on all interfaces  
❌ Engine accessible from public internet  
❌ Memory swap usage elevated  
❌ Security headers incomplete

### Deployment Quality

The deployment is well-structured with Coolify managing containerization and Traefik handling reverse proxy. However, several critical issues indicate incomplete testing before production attempt. The most urgent are:

1. **Build failures** — Cannot rebuild apps if issues arise
2. **Webhook failures** — Billing cannot be processed
3. **Auth errors** — Users cannot authenticate to builder

These must be fixed before any traffic is sent to production.

---

## CONCLUSION

Replybase SaaS has a **solid infrastructure foundation** but is **NOT production-ready** due to 8 critical and high-severity issues:

1. ❌ Production build fails (Prisma)
2. ❌ Server actions broken (SaaS + viewer)
3. ❌ Stripe webhooks blocked by auth
4. ❌ Typebot builder OIDC broken
5. ❌ Database schema incomplete (flows)
6. ❌ DEBUG enabled (security risk)
7. ❌ PostgreSQL exposed (0.0.0.0)
8. ❌ Engine publicly accessible

**With 2-3 hours of focused remediation + 4-5 hours of testing**, the system can be production-ready.

**Estimated Go-Live:** February 11-12, 2026

---

## SIGN-OFF

**Audit Conducted By:** Senior DevOps + Backend Lead Engineer  
**Date:** 11 February 2026  
**Next Steps:**

1. Address blocking issues (2-3 hours)
2. Execute live testing plan (4-5 hours)
3. Obtain final stakeholder approval
4. Deploy to production

**For questions or clarification, see detailed test logs in sections above.**
