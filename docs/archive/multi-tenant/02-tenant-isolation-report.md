# Tenant Isolation Report

## Isolation Architecture Review
The system uses a **discriminator column** (`tenantId`) strategy.
- **Enforcement Layer**: `lib/prisma-tenant.ts` implements a Prisma Client Extension that automatically injects `tenantId` into `where` clauses.
- **Middleware**: `lib/route-helpers.ts` (`withAuthAndTenant`) wraps API handlers, providing a pre-scoped DB client.

## Detected Leakage Risks

### 1. Check-then-Act Race Conditions & Bypass
Several routes (e.g., `app/api/bots/[botId]/route.ts`, `app/api/flows/[id]/route.ts`) use the global `prisma` client.
- **Pattern**:
  1. `findFirst({ where: { id, tenantId } })` (Validation)
  2. `update({ where: { id }, data })` (Mutation)
- **Risk**: If the validation step is skipped or logically flawed, the mutation is unscoped. Mutations should ideally be atomic: `update({ where: { id, tenantId }, data })`.

### 2. Manual Transaction Risks
In `app/api/bots/[botId]/route.ts` (DELETE), the transaction uses the global `prisma` client. While specific `deleteMany` calls are scoped, the `tx.bot.delete({ where: { id: botId } })` relies entirely on the previous check.

### 3. Public API Surface
`app/api/public/leads/route.ts` bypasses tenant isolation by design but relies on `publicKey` lookups. If a `publicKey` is leaked or guessed, leads can be injected into any tenant's database.

## Unsafe Query Patterns
| File Path | Pattern | Severity |
|-----------|---------|----------|
| `app/api/bots/[botId]/route.ts` | Unscoped `update` and `delete` | High |
| `app/api/flows/[id]/route.ts` | Unscoped `delete` | High |
| `app/api/leads/[leadId]/route.ts` | Unscoped `update` | High |

## Critical Cross-Tenant Attack Scenarios
- **IDOR on Update**: An attacker could potentially bypass the `findFirst` check if the application logic evolves to allow certain shared resources, leading to unauthorized updates of private bot configurations.
- **Stale Session/Tenant Spoofing**: NextAuth sessions contain `tenantId`. If a user is moved between tenants but their JWT is not invalidated, they may retain access to the previous `tenantId` until the JWT expires.

## Severity Ranking
| Risk | Severity | Impact |
|------|----------|--------|
| Inconsistent DB Client Usage | High | High risk of developer oversight leading to data leaks. |
| Unscoped Mutations | High | Direct IDOR vulnerability if validation is missed. |
| Missing RLS | Medium | Defense-in-depth weakness; reliance on app-layer logic. |
