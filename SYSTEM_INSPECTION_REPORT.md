# System Inspection Report: ReplyBase SaaS

## 1. Executive Summary

- **Overall System Score:** 4/10
- **Production Readiness:** NO-GO
- **Top Risks:**
  1. **Security Vulnerability:** Usage of Next.js 16.1.1 which has known high-severity vulnerabilities.
  2. **Data Isolation/Tenant Leaks:** Missing Row Level Security (RLS) in the database and lack of a centralized `middleware.ts` for strict authorization. Multi-tenancy isolation relies on manual, ad-hoc `tenantId` filtering in Prisma, which is highly prone to human error and data leakage.
  3. **Payment State Machine Flaws:** Silent failures and sync issues between Stripe and the local database; webhook processing relies heavily on DB persistence without fallbacks if DB is down.
  4. **Performance Bottlenecks:** Synchronous, blocking database calls inside API routes (e.g., messaging and leads API) without batching or caching.
  5. **UX Issues:** Onboarding requires extensive manual data entry, and flow drop-offs aren't handled gracefully.

---

## 2. Segment-wise Detailed Analysis

### A. System Architecture
- **Findings:** The architecture utilizes Next.js App Router with a `lib/` directory acting as a pseudo-service layer. However, the absence of `middleware.ts` means authorization is handled redundantly across individual routes using helpers like `withAuthAndTenant`.
- **Risks:** Missing a centralized point for route protection and tenant extraction. If a developer forgets to apply the helper, endpoints become completely unprotected.
- **Improvements:** Implement `middleware.ts` to enforce authentication, session validation, and tenant extraction globally.

### B. Code Quality & Maintainability
- **Findings:** There is significant technical debt, noted by heavy usage of `any` types and an inconsistent approach to UI handling (e.g., synchronous state updates).
- **Risks:** The high number of ESLint errors and warnings indicates a fragile codebase. `dangerouslySetInnerHTML` is used in `components/ui/chart.tsx` and `app/auth/register/page.tsx`, posing Cross-Site Scripting (XSS) risks.
- **Improvements:** Refactor to resolve ESLint errors, strictly type all AI and Webhook payloads, and sanitize inputs passed to `dangerouslySetInnerHTML`.

### C. Database & Data Integrity
- **Findings:** The Prisma schema captures relationships well, but entirely lacks database-level Row Level Security (RLS).
- **Risks:** High risk of data leaks. If a query omits the `where: { tenantId }` clause, data bleeds across tenants.
- **Improvements:** Implement PostgreSQL RLS policies to restrict row access based on the authenticated session context.

### D. Payment Processing
- **Findings:** The `lib/billing-service.ts` attempts to sync Stripe state with the DB. The webhook route (`app/api/billing/webhook/route.ts`) checks idempotency using `StripeEvent`.
- **Risks:** The webhook logic fails silently or cascades into errors if the local DB is briefly unavailable. "PAST_DUE" and downgrade states are inconsistently enforced across the app features.
- **Improvements:** Decouple webhook processing using a queue system (e.g., SQS or Redis), implement robust retry mechanisms, and enforce subscription state gating via middleware.

### E. Security Audit
- **Findings:** NextAuth is used, but the `isPlatformAdmin` logic relies entirely on a mutable `role` string. The `next` dependency is at a vulnerable version (16.1.1).
- **Risks:** Account takeover and privilege escalation risks due to vulnerable dependencies and ad-hoc authorization checks. No apparent rate-limiting on sensitive endpoints like `/api/auth/register`.
- **Improvements:** Upgrade Next.js immediately. Implement a global rate limiter. Centralize RBAC checks.

### F. Performance & Scalability
- **Findings:** Deeply nested and sequential Prisma queries are scattered throughout `/api/webchat/message/route.ts` and `/api/public/leads/route.ts`.
- **Risks:** At 10x load, these synchronous queries will exhaust the database connection pool and cause severe API latency, leading to timeout failures on messaging integrations (e.g., Meta/WhatsApp strict webhook timeouts).
- **Improvements:** Use `Promise.all` for independent DB queries, implement query batching, and utilize caching for frequently accessed, read-heavy data (e.g., bot configurations).

### G. UI System & Design
- **Findings:** ShadCN components are utilized, but core UX error boundaries (`loading.tsx`, `error.tsx`, `not-found.tsx`) are missing.
- **Risks:** Inconsistent user experience during network latency or failures.
- **Improvements:** Add global error boundaries and loading states across the `app/` directory.

### H. UX & User Journey
- **Findings:** The "First Reply" qualification logic requires users to manually engage to trigger a lead capture.
- **Risks:** High abandonment rates if the initial prompt isn't engaging enough. Onboarding relies heavily on manual input.
- **Improvements:** Improve the chatbot's opening hook and streamline the onboarding flow to use more progressive profiling.

### I. DevOps & Production Readiness
- **Findings:** Dockerfile is provided but lacks robust health checks beyond a simple wget. No automated database migration strategy tied safely to deployments without downtime.
- **Risks:** The deployment will likely suffer cold start issues and potential downtime during Prisma schema migrations.
- **Improvements:** Refine CI/CD pipelines to separate migration and deployment phases. Add telemetry and robust logging.

---

## 3. Critical Issues List

| Severity | Issue | Impact | Fix |
|---|---|---|---|
| Critical | Missing `middleware.ts` | Endpoints can be accidentally exposed, leading to data leaks. | Create a root `middleware.ts` to enforce authentication globally. |
| Critical | Vulnerable Next.js Version | Known high-severity vulnerabilities in Next.js 16.1.1. | Upgrade `next` to >= 16.1.7. |
| Critical | Missing Database RLS | Accidental cross-tenant data access if Prisma queries omit `tenantId`. | Implement PostgreSQL RLS for all tenant-scoped tables. |
| High | Unbatched DB Queries in Webhooks | Connection pool exhaustion under load, causing Meta webhook timeouts. | Implement query batching and connection pooling. |
| High | XSS Vulnerability Surface | `dangerouslySetInnerHTML` used without explicit sanitization. | Add DOMPurify or similar sanitization before rendering HTML. |

---

## 4. Risk Matrix

* **High Likelihood, High Impact:** Cross-tenant data leaks due to missing RLS; Meta webhook timeouts due to unbatched DB queries.
* **Low Likelihood, High Impact:** Complete system compromise via vulnerable Next.js version.
* **High Likelihood, Low Impact:** Poor UX due to missing `loading.tsx`/`error.tsx`.

---

## 5. Action Plan

### Immediate (0–3 days)
1. **Upgrade Next.js:** Bump `next` to the latest stable patch (16.1.7+).
2. **Implement Middleware:** Add `middleware.ts` for centralized route protection.
3. **Sanitize Inputs:** Audit and sanitize all `dangerouslySetInnerHTML` usages.

### Short-term (1–2 weeks)
1. **Database RLS:** Implement Row Level Security policies in PostgreSQL to enforce multi-tenancy.
2. **Performance Optimization:** Refactor `webchat` and `leads` API routes to batch database queries.
3. **UX Improvements:** Add `loading.tsx` and `error.tsx` across the application.

### Mid-term (1 month+)
1. **Refactor Payment Webhooks:** Move Stripe webhook processing to an async queue system to guarantee idempotency and resilience.
2. **Technical Debt Reduction:** Resolve the 195 ESLint errors and remove all `any` types.
3. **Monitoring:** Integrate proper APM and error tracking (e.g., Sentry, Datadog).
