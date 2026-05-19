# Security & Multi-Tenant Inspection Report - ReplyBase SaaS (Updated August 2026)

## 1. Multi-Tenant Isolation Analysis
- **Prisma Extension**: The `getTenantPrisma` extension is the primary defense. It uses DMMF introspection to automatically inject `tenantId` filters.
- **API Surface Coverage**:
    - **Scoping**: ~90% of `app/api` routes correctly use `withAuthAndTenant` or manual tenant scoping.
- **Gaps**:
    - **API Surface**: Legacy routes in `app/api/flows/route.ts`, `app/api/usage/route.ts`, and `app/api/billing/*` still utilize manual session-based scoping. While currently secure, these should be migrated to the `withAuthAndTenant` wrapper to ensure architectural consistency and eliminate the risk of future IDOR regressions during refactoring.
    - **Background Workers**: Core workers like `whatsapp-worker.ts` and `flow-recovery-worker.ts` rely on the global `prisma` instance and manual query filtering. This increases the risk of developer error in complex cross-service calls.
- **Database Unique Constraints**: Gold-standard `@@unique([id, tenantId])` is consistently used on core models (`Lead`, `Flow`, `Bot`), preventing cross-tenant IDOR even if a query filter were missed. `WebhookLog` also now correctly incorporates `tenantId` in all creation paths.

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
1. **Universal Scoping (HIGH)**: Refactor legacy routes (Flows, Usage, Billing) to use the `withAuthAndTenant` helper, replacing manual `getServerSession` and `tenantId` lookups (Task 027). Standardize workers to use the Scoped Repository Pattern (Task 032).
2. **CORS Whitelisting (HIGH)**: Implement strict `Origin` validation for Webchat endpoints against the `allowedDomains` field in the `WebChatSite` model (Task 030). Current `lib/webchat-cors.ts` uses environment-based global whitelists; it must transition to per-site DB-based validation to ensure tenant-specific domain enforcement.
3. **Automated Scanning**: Integrate ZAP or similar for automated OWASP Top 10 checks in CI.
