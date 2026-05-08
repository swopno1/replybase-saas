# Multi-Tenant Isolation Audit: ReplyBase SaaS

## 1. Isolation Strategy
**Mechanism**: Logical isolation via `tenantId` discriminator on all primary entities.
**Enforcement**:
- **Prisma Extension**: `lib/prisma-tenant.ts` automatically injects `tenantId` into `where`, `create`, and `update` arguments.
- **Middleware Scoping**: `withAuthAndTenant` route helper ensures every request is context-bound to the logged-in user's `tenantId`.

---

## 2. Risk Assessment
### High Risk: Mixed Client Usage
- **Findings**: Some API routes import the global `prisma` client directly instead of using the scoped client provided by the middleware.
- **Impact**: Bypasses the automatic `tenantId` injection. If a developer forgets a manual `where: { tenantId }` filter, data leakage occurs.

### High Risk: Execution Logs & Tenant Context
- **Findings**: The `ExecutionLog` model lacks a direct `tenantId` field. It relies on a join to the `Bot` model (`botId`).
- **Impact**: Queries for logs must always join through `Bot`. If a query is run against `ExecutionLog` directly (e.g., for global analytics), it could inadvertently access data across tenants.
- **Remediation**: Add `tenantId` directly to the `ExecutionLog` model for faster, safer querying.

### Medium Risk: Webhook Routing
- **Findings**: Facebook/WhatsApp webhooks are public endpoints. They resolve `tenantId` by looking up the `pageId` or `phoneNumberId`.
- **Impact**: If a malicious user manages to "register" a `pageId` already owned by another tenant (unlikely due to Meta token verification), they could hijack traffic.
- **Mitigation**: Meta token verification is implemented (`appsecret_proof`), providing strong protection against this.

---

## 3. Atomic Mutation Integrity
Several routes perform "Check then Update" operations:
1. `findFirst({ where: { id, tenantId } })`
2. `update({ where: { id }, data })`

**Problem**: If Step 1 passes but contains a logic error, Step 2 is unscoped.
**Recommendation**: Use **Atomic Scoped Mutations**:
```typescript
await db.bot.update({
  where: { id, tenantId }, // Scoped!
  data: { ... }
});
```

---

## 4. Verdict
The isolation architecture is **Professional Grade** but needs **Consistency Hardening**.
- **Confidence Level**: 85%
- **Critical Remediation**: Migrate all mutations to include `tenantId` in the `where` clause, and add `tenantId` to the `ExecutionLog` model.
