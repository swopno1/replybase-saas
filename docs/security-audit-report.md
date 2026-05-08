# Security Audit Report: ReplyBase SaaS

## 1. Authentication Audit
### Status: **PASS (STRONG)**
- **NextAuth.js**: Properly configured with JWT sessions.
- **CSRF Protection**: Native NextAuth CSRF protection is active for all auth routes.
- **Password Security**: Bcrypt hashing confirmed in `lib/server/password.ts`.
- **OAuth Safety**: App secret proof (`appsecret_proof`) implemented for Meta/Facebook Graph API calls to prevent token hijacking.

---

## 2. Authorization & Multi-Tenancy
### Status: **CAUTION (POTENTIAL LEAK VECTORS)**
The system relies on a Prisma Extension (`lib/prisma-tenant.ts`) for automatic `tenantId` scoping. However, manual implementation inconsistencies exist.

### Critical Findings:
- **[High] Check-then-Act Race Conditions**:
  - **Bot/Flow Mutations**: Some routes (e.g., `app/api/bots/[botId]/route.ts`) use the global `prisma` client for updates/deletes after a separate validation check. If validation is bypassed or flawed, a user could modify resources belonging to other tenants.
  - **Atomic Scoping**: Mutations should use composite unique keys: `prisma.bot.update({ where: { id, tenantId }, ... })`.

- **[Medium] Admin API Surface**:
  - `/api/admin/*` routes are protected by `isPlatformAdmin`. However, specific record ownership is often ignored in admin views (as intended for admins), but this requires strict session validation.

- **[Medium] Public Lead Injection**:
  - `/api/public/leads` uses `publicKey`. While standard for "widgets", a leaked public key allows spamming a tenant's CRM. *Recommendation*: Implement per-site domain whitelisting (CORS) which is partially present but should be strictly enforced at the database level.

---

## 3. Vulnerability Analysis
### XSS (Cross-Site Scripting)
- **dangerouslySetInnerHTML**:
  - Used in `components/ui/chart.tsx` (safe, internal library usage).
  - Used in `app/auth/register/page.tsx` for JSON-LD.
- **Risk**: Low. No user-controlled data currently reaches these sinks. However, any future "Custom CSS" or "Custom HTML" features for the Webchat widget must be strictly sanitized.

### IDOR (Insecure Direct Object Reference)
- **Finding**: High risk in routes using `findFirst` followed by a global `update`.
- **Remediation**: Standardize all API routes to use the scoped `db` client provided by `withAuthAndTenant`, and ensure all mutations include `tenantId` in the `where` clause.

---

## 4. Encryption & Data Safety
- **Integration Keys**: Telegram and WhatsApp credentials are encrypted using AES-256-GCM (`lib/channel-credentials-crypto.ts`).
- **Data Deletion**: GDPR-compliant deletion flows are implemented for Facebook and manual user requests.

---

## Summary of Fixes Required
1. **Refactor Mutations**: Change `update({ where: { id } })` to `update({ where: { id, tenantId } })` across all tenant-facing APIs.
2. **Standardize Scoped Client**: Deprecate direct imports of the global `prisma` client in `app/api/` in favor of the scoped client.
3. **Session Hardening**: Ensure JWT `tenantId` is immutable once issued per session.
