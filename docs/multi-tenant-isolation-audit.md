# Multi-Tenant Isolation Audit: ReplyBase SaaS

## 1. Isolation Architecture
### Status: **PASS (CONCEPTUAL)**
- **Shared Database**: All tenants share the same PostgreSQL database.
- **Tenant ID Scoping**: Every core entity contains a `tenantId` field.
- **Automated Scoping**: A Prisma extension in `lib/prisma-tenant.ts` automatically injects `where: { tenantId }` into queries.

---

## 2. Enforcement Gaps & IDOR Risks
### Status: **HIGH RISK**
The primary risk is the inconsistent use of the scoped Prisma client. Developers often import `prisma` from `@/lib/prisma` (global) instead of using the scoped client provided by `withAuthAndTenant`.

### Critical Findings:
- **[High] Unscoped Mutations**:
  - API routes that use direct `.update()` or `.delete()` calls with only the record `id` are vulnerable to IDOR (Insecure Direct Object Reference).
  - **Identified Routes**:
    - `app/api/bots/[botId]/channels/facebook/[pageId]/route.ts`: Uses `prisma.facebookPage.delete({ where: { id: facebookPage.id } })`.
    - `app/api/contacts/[contactId]/route.ts`: Several mutations use direct `db.contact.update({ where: { id: contactId } })`.
    - `app/api/flows/[id]/route.ts`: Uses `prisma.flow.update({ where: { id } })`.
  - **Attack Vector**: A malicious user in Tenant A could capture a request to delete a bot, swap the bot `id` for Tenant B's bot `id`, and successfully delete it if the route doesn't verify the `tenantId` in the `where` clause.

- **[Medium] Webchat Token Immortality**:
  - The Webchat session token (`lib/webchat-session.ts`) encodes the `tenantId`.
  - **Risk**: If a tenant's `siteId` is leaked or intentionally shared, the CORS protection is the only barrier. If CORS is misconfigured (e.g., wildcard allowed), cross-tenant message injection is possible.
  - **Remediation**: Verify the `siteId` in the token matches the bot's configured `siteId` during every message ingestion.

- **[Medium] Webhook Log Collision**:
  - `WebhookLog` model lacks a `tenantId` field.
  - **Risk**: Webhook logs for all tenants are mixed in a single global table. While the admin UI filters them, the database-level isolation is absent.
  - **Remediation**: Add `tenantId` to `WebhookLog` and index it for faster tenant-specific lookups.

---

## 3. Recommendations & Hardening Plan
1. **Mandatory Scoped Client**:
   - Forbid direct imports of `@/lib/prisma` in `app/api/` (except for auth and webhooks).
   - Enforce usage of `withAuthAndTenant` for all tenant-facing routes.
2. **Compound Keys**:
   - Update all mutations to use compound unique constraints:
     ```typescript
     // UNSAFE
     prisma.bot.update({ where: { id } })

     // SAFE
     prisma.bot.update({ where: { id, tenantId } })
     ```
3. **Prisma Extension Hardening**:
   - Update `lib/prisma-tenant.ts` to throw a runtime error if a query is attempted on a tenant-scoped model without a `tenantId` provided in the context, even for `findUnique`.

---

## 4. Isolation Action Plan
| Issue | Severity | Recommendation | Status |
| :--- | :--- | :--- | :--- |
| Unscoped `.delete()` | High | Add `tenantId` to all delete where clauses. | **PENDING** |
| Unscoped `.update()` | High | Add `tenantId` to all update where clauses. | **PENDING** |
| WebhookLog Isolation | Medium | Add `tenantId` column to `webhook_logs` table. | **BACKLOG** |
| JWT Tenant Check | Medium | Re-verify tenant membership on every sensitive action. | **IN PROGRESS** |

**Audit Verdict**: While the foundation for isolation is present, the implementation is "Swiss cheese" due to manual coding errors in mutation routes. This must be remediated before production traffic.
