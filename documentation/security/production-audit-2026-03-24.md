# Production Audit and Hardening Report (2026-03-24)

## Scope

Audit focus areas:

- API routes in `app/api/**`
- Auth and middleware surfaces
- Prisma configuration and database schema
- Billing, webhook, and integration endpoints

Implemented in this pass:

- Input validation hardening
- Secret handling hardening
- Error leakage reduction
- Failure-mode hardening
- Minimal performance improvements in auth wrappers

## Changes Implemented

### 1) Prisma bootstrap safety (production fail-fast)

File:

- `lib/prisma.ts`

Change:

- Throw on missing `DATABASE_URL` in production.
- Keep non-production fallback behavior for local/dev only.

Why:

- Prevent silent startup with dummy database credentials in production.

### 2) Rate-limit failure mode changed to fail-closed

File:

- `lib/rate-limit.ts`

Change:

- On rate-limit middleware errors, return blocked response metadata (`allowed: false`) instead of unlimited allowance.

Why:

- Avoid abuse bypass during dependency outages.

### 3) Timing-safe API key comparison

File:

- `lib/api-auth.ts`

Change:

- Replaced plain string equality with `timingSafeEqual`-based comparison helper.

Why:

- Reduces timing side-channel risk for API secret checks.

### 4) Facebook Graph token leakage reduction

File:

- `app/api/integrations/facebook/pages/route.ts`

Change:

- Stopped passing access token in query string.
- Switched to `Authorization: Bearer ...` header.

Why:

- Query strings can be logged by infrastructure and leak credentials.

### 5) Execution logs query hardening

File:

- `app/api/execution-logs/route.ts`

Change:

- Added radix-safe parsing with `Number.parseInt(..., 10)`.
- Clamped `limit` to `[1, 500]` and `offset` to `>= 0`.

Why:

- Prevent malformed parameter behavior and unbounded query requests.

### 6) Facebook webhook robustness and production verification

File:

- `app/api/facebook/webhook/route.ts`

Change:

- Require signature verification preconditions in production.
- Added safe JSON parse handling for raw webhook payload.
- Return explicit 400 for malformed JSON payloads.

Why:

- Prevent unverified production webhook acceptance and parse crashes.

### 7) Billing checkout validation and error hardening

File:

- `app/api/billing/checkout/route.ts`

Change:

- Added request body validation via Zod.
- Removed internal error message leakage from API response.
- Replaced temporary Stripe ID timestamp strategy with UUID-based value.
- Added explicit failure path when required `free` plan is missing.

Why:

- Protect endpoint contract, reduce sensitive error disclosure, and avoid ID collision risk.

### 8) Auth wrapper DB query minimization

File:

- `lib/route-helpers.ts`

Change:

- Query only `id` and `tenantId` fields.
- Added guarded error response on tenant-context lookup failure.

Why:

- Reduces unnecessary data retrieval and improves predictable error behavior.

### 9) Lint and type-safety stabilization pass

Files:

- `app/(dashboard)/activity/page.tsx`
- `app/api/facebook/webhook/route.ts`
- `app/api/oidc/[...oidc]/route.ts`
- plus additional app/api/lib/scripts/test files with warning-only cleanup

Change:

- Removed explicit `any` usage in high-signal runtime paths.
- Fixed strict typing regressions found during production build validation.
- Removed unused imports/locals/params to produce a clean lint baseline.

Why:

- Ensure code quality gates are green and reduce risk of hidden type drift.

## Removed or Archived Code

No runtime code was deleted in this hardening pass.

Notes:

- Several unrelated workspace changes already exist in docs and archive files.
- These were not reverted or modified beyond touched security/backend files.

## Remaining High-Priority Follow-Ups

1. Subscription usage enforcement still includes TODO behavior (`lib/subscription.ts`) and should be completed for true plan-limit enforcement.
2. Prisma schema contains a large mixed domain model surface (ReplyBase + legacy Typebot-style models). Consider schema split or separate data source boundaries to reduce operational risk.
3. Add central request validation middleware (Zod) for high-risk POST/PATCH routes to enforce consistent input contracts.
4. Add structured server logging with redaction policy for tokens, email identifiers, and webhook payload fragments.

## Build and Validation Status

Ran:

- `npm run lint`
- `npm run build`

Result summary:

- `npm run lint`: pass (0 errors, 0 warnings)
- `npm run build`: pass (Next.js + TypeScript + route generation)
- Build warning remains: middleware convention deprecation in Next.js 16 (`middleware` -> `proxy` migration path).

## Recommended Production Readiness Commands

Run in `replybase-saas`:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Database checks:

```bash
npx prisma validate
npx prisma migrate status
```

## Suggested Next Refactor Wave

1. Create `lib/validation/` schemas per endpoint group and enforce parser-first handlers.
2. Consolidate webhook verification patterns into shared utility wrappers with uniform replay checks.
3. Introduce centralized `AppError` mapping for stable API error payloads and observability tags.
4. Normalize schema ownership boundaries to isolate legacy non-core models from tenant runtime models.
