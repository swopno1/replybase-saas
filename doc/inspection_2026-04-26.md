# Replybase SaaS Production Readiness Report

**Date:** 2026-04-26
**Auditor:** Jules (AI Software Engineer)
**Status:** Conditional GO

---

## 1. Executive Summary

The Replybase SaaS codebase is in a strong state with a modern tech stack (Next.js 16, Prisma, Tailwind CSS). The application demonstrates clear multi-tenant architecture and robust security practices, including credential encryption and centralized authentication.

However, several "last-mile" issues were identified that could impact production stability, developer onboarding, and long-term maintainability. The most critical findings relate to environment configuration documentation, manual multi-tenant scoping, and minor database performance gaps.

With the resolution of the high-priority items listed below, the system is ready for production deployment.

---

## 2. Detailed Findings by Category

### 2.1 Configuration & Environment
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| Missing `.env.example` | **Medium** | Over 80 environment variables are used, but no template exists. This makes deployment and onboarding difficult. | Root |
| Encryption Key Fallback | **High** | `lib/channel-credentials-crypto.ts` falls back to `AUTH_SECRET` if `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` is missing. Changing `AUTH_SECRET` would then break existing credentials. | `lib/channel-credentials-crypto.ts` |
| Dead AI Routes | **Low** | `app/api/ai/gemini/route.ts` was referenced in previous audits but is missing/moved, replaced by a centralized `chat` route. | `app/api/ai` |

### 2.2 Security & Multi-Tenancy
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| Manual Tenant Scoping | **High** | Multi-tenancy relies on manual application of `tenantId` in every query. Lack of Row Level Security (RLS) increases risk of IDOR. | `app/api/conversations/` |
| JWT Subscription Cache | **Medium** | Subscription status is cached in the JWT for 1 hour. This can lead to stale state if a user upgrades or cancels. | `lib/auth.ts` |
| Password Reset Placeholder | **Low** | Memory suggested email was a placeholder, but it is integrated with Resend. However, fallback is just a console log. | `lib/email.ts` |

### 2.3 Performance & Scalability
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| Missing Message Index | **Medium** | `CrmMessage` lacks an index on `createdAt`. As conversation history grows, performance of history fetching will degrade. | `prisma/schema.prisma` |
| Usage Log Upsert Load | **Low** | High-frequency `upsert` on `UsageLog` for every message might become a bottleneck under extreme load. | `lib/subscription.ts` |

### 2.4 Technical Debt
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| Usage of `any` types | **Medium** | 26 occurrences of `any` types, particularly in AI message history and admin routes, bypassing type safety. | `lib/ai-fallback.ts` |
| Unfinished Flow Features | **Medium** | TODOs indicate missing support for interactive elements (buttons/quick replies) in the flow engine. | `lib/flow-execution-engine.ts` |
| Redundant Scripts | **Low** | Several scratch and migration scripts remain in the root or `scratch/` folder. | `scratch/`, `scripts/` |
| Broken Test File | **Medium** | `tests/facebook-ui.test.tsx` fails to compile due to a double declaration of `mockRouter`. | `tests/facebook-ui.test.tsx` |

### 2.5 UX & Accessibility
| Finding | Severity | Description | File/Reference |
|:---|:---:|:---|:---|
| Tabs Mobile Overflow | **Low** | `SettingsTabs` triggers use `whitespace-nowrap`, which will likely cause horizontal overflow on small mobile screens. | `components/settings/settings-tabs.tsx` |
| Inconsistent AI UI | **Low** | Standard HTML `select` is used for AI settings instead of the themed shadcn/ui Select component. | `components/settings/settings-tabs.tsx` |

---

## 3. Severity and Impact Assessment

*   **Critical/High:** Items that could lead to data leaks (multi-tenancy) or permanent data loss/access issues (encryption keys).
*   **Medium:** Items that impact maintainability, performance at scale, or standard SaaS features (STALE subscription state).
*   **Low:** Minor UX polish or documentation cleanup.

---

## 4. Actionable Recommendations

### Phase 1: Pre-Launch (Immediate)
1.  **Create `.env.example`:** Document all 80+ variables with descriptions.
2.  **Enforce Encryption Key:** Remove the fallback to `AUTH_SECRET` in `lib/channel-credentials-crypto.ts` and require a dedicated key.
3.  **Add Database Index:** Add `@@index([createdAt])` to the `CrmMessage` model.
4.  **Shorten Subscription Cache:** Reduce the JWT subscription check interval from 1 hour to 5-15 minutes or implement a webhook-based refresh.

### Phase 2: Post-Launch (Stabilization)
1.  **Type Safety:** Replace `: any` with proper Zod schemas or interfaces, especially for AI payloads.
2.  **Interactive Flows:** Implement the TODOs for quick replies and buttons in the flow engine.
3.  **RLS Investigation:** Explore PostgreSQL Row Level Security to provide a secondary layer of tenant isolation.

---

## 5. Final Go/No-Go Decision

**Decision: Conditional GO**

The system is architecturally sound and functionally complete for the MVP scope. However, 66 linting errors and a broken UI test file indicate that the codebase requires a "cleanup sprint" before being considered fully production-ready.

**Rationale:**
- **Security:** Authentication and Multi-tenancy are correctly implemented at the route level, and critical credentials are encrypted.
- **Functionality:** Core business logic (AI, Flows, Billing) is present and integrated.
- **Stability:** Most unit and integration tests (208) pass, proving the core engine is stable.
- **Risks:** The gaps are primarily in documentation (`.env.example`), performance optimization (indices), and code hygiene (linting/types).
