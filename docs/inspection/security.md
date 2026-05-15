# Security & Multi-Tenant Inspection Report - ReplyBase SaaS (Updated August 2026)

## 1. Multi-Tenant Isolation Analysis
- **Prisma Extension**: The `getTenantPrisma` extension is the primary defense. It uses DMMF introspection to automatically inject `tenantId` filters.
- **API Surface Coverage**:
    - **Scoping**: ~90% of `app/api` routes correctly use `withAuthAndTenant` or manual tenant scoping.
    - **Gaps**: Some legacy routes (e.g., `app/api/flows/route.ts`) perform manual scoping. While functional, they represent a higher maintenance risk than the automated extension pattern.
- **Database Unique Constraints**: Gold-standard `@@unique([id, tenantId])` is consistently used on core models (`Lead`, `Flow`, `Bot`), preventing cross-tenant IDOR even if a query filter were missed.

## 2. Authentication & Session Integrity
- **Auth Provider**: NextAuth (Auth.js) with hardened JWT sessions.
- **Tenant Baking**: `tenantId` is strictly bound to the session JWT, preventing session hijacking for cross-tenant access.
- **Impersonation Mode**: Securely implemented for SUPERADMINs with audit-logging. Targeted tenant is stored in an `originalTenantId` field during the session.

## 3. Webhook Security & Idempotency
- **Signature Verification**:
    - **Stripe**: Fully verified using `STRIPE_WEBHOOK_SECRET`.
    - **Meta/WhatsApp**: X-Hub-Signature-256 verification is active.
    - **Telegram**: Secret token verification is active.
- **Idempotency**: `StripeEvent` and `IdempotencyKey` tables prevent duplicate processing of financial and messaging events.

## 4. Administrative Security
- **Admin Boundaries**: `/api/admin/*` routes strictly enforce `isPlatformAdmin`.
- **Audit Logging**: `AdminActivity` logs are implemented for mutations.
- **PII Protection**: Superadmins have read-access to tenant data for support. **RISK**: Read-only audit logging (Task 021) is still PENDING.

## 5. Security Risk Assessment
| Risk | Severity | Status | Mitigation |
| :--- | :--- | :--- | :--- |
| **IDOR** | Low | Controlled | Mandatory `withAuthAndTenant` and `@@unique` constraints. |
| **PII Exposure** | Medium | PENDING | Implement Read-Only Audit Logging (Task 021). |
| **Prompt Injection** | Medium | PENDING | Implement LLM Guardrails for AI Fallback. |
| **XSS** | Low | Monitoring | Periodic audit of `dangerouslySetInnerHTML` in charts. |

## 6. Recommended Hardening
1. **Universal Scoping**: Migrate remaining manual scoping in `app/api/flows/` to `withAuthAndTenant`.
2. **CORS Strictness**: Enforce `allowedDomains` whitelist for Webchat init/message endpoints.
3. **Automated Scanning**: Integrate ZAP or similar for automated OWASP Top 10 checks in CI.
