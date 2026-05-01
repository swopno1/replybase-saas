# Production Readiness Report - Replybase SaaS
**Date:** 2026-05-01
**Auditor:** Jules (AI Software Engineer)
**Status:** **NO-GO**

---

## 1. Executive Summary

A comprehensive inspection of the Replybase SaaS codebase was conducted on May 1, 2026. While several critical logical errors reported in previous audits (such as the broken Conversations API) have been resolved, the platform is not yet ready for production deployment.

The primary blockers are **High-Severity Security Vulnerabilities** in the core framework (`next` v16.1.1) and a lack of global application security controls (e.g., missing root middleware). Additionally, significant technical debt in the form of 105 unresolved ESLint errors and multiple `TODO` placeholders in critical business logic (AI context injection and usage notifications) poses a risk to operational stability and product quality.

Deployment is strictly not recommended until the security vulnerabilities are patched and global protections are implemented.

---

## 2. Detailed Findings by Category

### 2.1 Security & Data Privacy
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| **High-Severity Vulnerabilities** | **High** | Two high-severity vulnerabilities in `next` (v16.1.1) related to unbounded memory consumption and buffering, leading to potential DoS attacks. | `package.json`, `pnpm audit` |
| **Missing Global Middleware** | **High** | No root `middleware.ts` exists to enforce a "default-deny" policy for dashboard and API routes. Relying solely on per-route helpers increases the risk of accidental exposure. | Global |
| **Manual Tenant Isolation** | **High** | Multi-tenancy isolation is handled exclusively at the application layer via `tenantId` filtering. The lack of Row Level Security (RLS) remains a high-risk factor for data leaks via developer oversight. | Global / `doc/rls-investigation.md` |
| **XSS Surface Area** | **Medium** | Usage of `dangerouslySetInnerHTML` in `chart.tsx` for CSS injection and `register/page.tsx` for JSON-LD. While likely safe in current contexts, it requires strict monitoring. | `components/ui/chart.tsx`, `app/auth/register/page.tsx` |

### 2.2 Logical Errors & Unfinished Features
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| **Leads Export Gating** | **Medium** | The Leads UI lacks logic to disable the export button based on the `canExport` flag returned by the API. Paid features are visible but potentially non-functional or inconsistent for free users. | `app/(dashboard)/leads/page.tsx` |
| **Placeholder AI Logic** | **Medium** | `lib/ai-fallback.ts` contains `TODO` comments regarding more robust context injection. Current AI responses may lack necessary business context for non-pro plans. | `lib/ai-fallback.ts` |
| **Incomplete Flow Features** | **Medium** | The flow execution engine (`lib/flow-execution-engine.ts`) has `TODO` placeholders for interactive elements (buttons/quick replies) and external webhooks. | `lib/flow-execution-engine.ts` |
| **Onboarding Type Safety** | **Medium** | The onboarding flow still uses significant type casting (e.g., `unknown` or `Record<string, unknown>`), representing ongoing technical debt that complicates future maintenance. | `components/onboarding/onboarding-modal.tsx` |

### 2.3 Technical Debt & Maintenance
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| **Linting Backlog** | **High** | 195 ESLint problems persist, including 105 errors. Critical issues include React Hook violations (state updates in effects) and unused variables in test files. | Global |
| **Usage Notification Gaps** | **Medium** | Logic for notifying users when they reach 80%/100% of their plan limits is currently limited to `ActivityLog` entries. Email integration is marked as a `TODO`. | `lib/subscription.ts` |
| **Missing UX Resiliency** | **Low** | Absence of `loading.tsx` and global `error.tsx` files across the dashboard leads to a "jittery" experience during data fetching or unexpected failures. | `app/` directory |

---

## 3. Severity and Impact Assessment

*   **High (MUST-FIX):** Security vulnerabilities (DoS) and missing global route protection that threaten platform integrity and availability.
*   **Medium (BLOCKER FOR SCALE):** Significant linting issues, missing feature-gating in the UI, and unfinished AI/Flow logic that affects product value and developer velocity.
*   **Low (UX/POLISH):** Missing loading states and placeholder email logic.

---

## 4. Actionable Recommendations

### Phase 1: Security Hardening (Immediate)
1.  **Patch Framework:** Update `next` to `v16.1.7` or higher immediately to resolve high-severity DoS vulnerabilities.
2.  **Global Middleware:** Implement a root `middleware.ts` to enforce session verification and tenant isolation as a default for all `/(dashboard)` and `/api` routes.
3.  **Implement RLS:** Begin the phased rollout of PostgreSQL Row Level Security (RLS) as outlined in `doc/rls-investigation.md` to move isolation to the database layer.

### Phase 2: Feature & UX Alignment
1.  **Sync UI Gating:** Update `app/(dashboard)/leads/page.tsx` to respect the `canExport` flag from the `/api/leads` response, disabling export buttons for ineligible users.
2.  **Complete AI Context:** Finalize the AI context injection logic in `lib/ai-fallback.ts` to ensure paid users receive the intended value.
3.  **Add UX Boundaries:** Create `loading.tsx` and `error.tsx` files for core dashboard routes to improve perceived performance and error handling.

### Phase 3: Quality Control
1.  **Resolve Lint Errors:** Address the 105 ESLint errors, focusing on React Hook violations that could cause runtime bugs.
2.  **Email Notifications:** Integrate the `sendEmail` utility with the usage monitoring logic in `lib/subscription.ts`.

---

## 5. Final Go/No-Go Decision

**Decision: NO-GO**

**Rationale:**
The current state of the codebase presents unacceptable security risks. Specifically, the high-severity vulnerabilities in the `next` framework and the absence of a centralized security middleware are critical blockers for a production launch. Furthermore, the high volume of ESLint errors and unfinished core features (AI context and interactive flows) suggests that the product is not yet stable enough for a reliable user experience. A stabilization period focused on security and code quality is required before re-evaluation.
