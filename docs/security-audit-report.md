# Security Audit Report: ReplyBase SaaS

## 1. Authentication Audit
### Status: **PASS (STRONG)**
- **NextAuth.js**: Properly configured with JWT sessions and secure HTTP-only cookies.
- **CSRF Protection**: Native NextAuth CSRF protection is active for all auth routes.
- **Password Security**: Bcrypt hashing confirmed in `lib/server/password.ts`.
- **OAuth Safety**: App secret proof (`appsecret_proof`) implemented for Meta/Facebook Graph API calls to prevent token hijacking by malicious actors with stolen access tokens.
- **Session Hardening**: The JWT contains an immutable `tenantId`, which is verified in every protected route.

---

## 2. Authorization & Multi-Tenancy
### Status: **CAUTION (POTENTIAL IDOR VECTORS)**
The system uses a Prisma Extension (`lib/prisma-tenant.ts`) for automatic `tenantId` scoping. However, the audit revealed manual implementation gaps that bypass this protection.

### Critical Findings:
- **[High] Unscoped Mutations (IDOR Risk)**:
  - Several API routes use `prisma.model.update({ where: { id: someId } })` or `prisma.model.delete({ where: { id: someId } })` instead of including the `tenantId` in the filter.
  - While the `withAuthAndTenant` wrapper provides a scoped `db` client, some routes directly import and use the global `prisma` client, bypassing the automatic isolation extension.
  - **Example**: `app/api/bots/[botId]/channels/facebook/[pageId]/route.ts` uses `prisma.facebookPage.delete({ where: { id: facebookPage.id } })`. If a malicious user manages to predict or leak another tenant's internal `id` (CUID), they could potentially trigger deletions.
  - **Remediation**: Standardize all mutations to use compound unique constraints: `{ where: { id, tenantId } }` and strictly use the scoped `db` client from the route helper.

- **[Medium] Admin API Surface**:
  - `/api/admin/*` routes are protected by `isPlatformAdmin`. While correct, these routes often have broad read/write access to all tenants.
  - **Risk**: A compromised admin account or a flaw in the `isPlatformAdmin` logic (e.g., misconfigured environment variables) grants full system access.
  - **Remediation**: Implement two-factor authentication (2FA) for admin roles and add granular logging for all admin actions.

---

## 3. Vulnerability Analysis
### XSS (Cross-Site Scripting)
- **dangerouslySetInnerHTML**:
  - Used in `components/ui/chart.tsx` for tooltips. (Safe: Internal Shadcn/Recharts usage).
  - Used in `app/auth/register/page.tsx` for JSON-LD. (Safe: Static structure).
- **Risk**: Low today, but a potential vector if tenant-customizable "Bot Descriptions" or "Welcome Messages" are rendered via this method in the future without sanitization.
- **Remediation**: Introduce a global sanitization utility (e.g., `dompurify`) if HTML rendering is ever opened to user input.

### SQL Injection
- **Status**: **PASS**
- **Analysis**: The application uses Prisma ORM for almost all operations, which uses parameterized queries by default. Raw SQL is only used in controlled migrations and specific ROI/Revenue calculations where inputs are strictly typed.

---

## 4. Encryption & Data Safety
- **Integration Keys**: Telegram and WhatsApp credentials (tokens/API keys) are encrypted using AES-256-GCM in `lib/channel-credentials-crypto.ts`. The IV is stored alongside the ciphertext.
- **Data Deletion**: GDPR-compliant deletion flows are implemented for Facebook (`app/api/facebook/data-deletion`) and manual user requests.
- **Logging**: Webhook logs (`WebhookLog`) currently store full payloads.
  - **Risk**: Potential PII (Personally Identifiable Information) or sensitive tokens leaked into logs.
  - **Remediation**: Implement a log scrubbing filter to mask sensitive fields (e.g., `access_token`, `password`) before saving to `webhook_logs`.

---

## 5. Security Summary & Action Plan
| Ref | Finding | Severity | Recommendation |
| :--- | :--- | :--- | :--- |
| SEC-01 | Unscoped Mutations | High | Refactor all `.update()` and `.delete()` calls to include `tenantId` in `where`. |
| SEC-02 | Admin 2FA Missing | Medium | Enforce 2FA for users with `ADMIN` or `SUPERADMIN` roles. |
| SEC-03 | Log PII Leakage | Medium | Scrub sensitive fields from `WebhookLog` payloads. |
| SEC-04 | Redis TCP Security | Low | Ensure production Redis uses TLS and password authentication (verified in `lib/redis.ts`). |

**Audit Verdict**: The core security architecture is strong, but "Last Mile" multi-tenancy enforcement (scoping mutations) is the primary blocker for a secure production rollout.
