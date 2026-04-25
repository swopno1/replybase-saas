# Production Readiness Inspection Report - Replybase SaaS

**Date:** 2026-04-25
**Status:** 🔴 **NO-GO**
**Overall Readiness:** 35%

---

## 1. Executive Summary
This report details the findings of a comprehensive codebase inspection of the Replybase SaaS platform. While the core multi-tenant architecture and CRM models are well-defined, the application is currently **not production-ready**.

Critical blockers exist in the **OIDC Authentication flow**, **Production Emailing**, and **Webchat Runtime Stability**. Deploying in the current state would result in a broken Typebot integration, inability for users to reset passwords or receive notifications, and potential crashes in the webchat widget.

---

## 2. Deployment Readiness Checklist

| Category | Status | Notes |
| :--- | :--- | :--- |
| **Authentication** | 🟡 Partial | NextAuth is solid; OIDC Provider is missing interaction routes. |
| **Integrations** | 🔴 Critical Gaps | Stripe/Meta/Telegram logic exists but OIDC for Typebot is broken. |
| **Stability** | 🟠 Risky | 1 failing core test; multiple "setState in effect" lint errors. |
| **Security** | 🟡 Moderate | CSP/HSTS headers present; some hardcoded defaults in OIDC. |
| **Operations** | 🔴 Poor | No email provider; missing `.env.example`. |

---

## 3. Detailed Findings

### 3.1. Configuration & Environment
*   **Missing `.env.example`:** There is no template for the ~100 environment variables required. This makes local setup and CI/CD configuration extremely difficult and error-prone.
*   **OIDC Defaults:** `lib/oidc-provider.ts` uses `"insecure-default-key-change-me"` as a fallback for `OIDC_COOKIE_KEY`.
*   **Build Artifacts:** `build_log.txt` and `build_output.log` are present in the root directory, indicating manual build attempts that should be cleaned up.

### 3.2. OIDC & Typebot Integration (Critical Blockers)
*   **Missing Interaction Routes:** The `getOidcProvider` in `lib/oidc-provider.ts` redirects users to `/api/oidc/interaction/${uid}`, but the `app/api/oidc/interaction/` directory and its corresponding routes do not exist. **Typebot integration will not work.**
*   **Hardcoded Issuer Fallback:** `lib/oidc-provider.ts` and `app/api/oidc/[...oidc]/route.ts` both fallback to `https://app.replybase.co.uk` if `NEXT_PUBLIC_APP_URL` is missing, which might cause issues in staging/dev environments.

### 3.3. Code Logic & Runtime Errors
*   **Webchat Engine Crash:** `lib/webchat-conversation-engine.ts:403` crashes with `TypeError: Cannot read properties of undefined (reading 'getTime')` because it assumes `activeSession.updatedAt` is always present on the mock/object.
*   **Placeholder Email Service:** `lib/email.ts` is a placeholder that only logs to the console. Password resets and lead notifications will not work in production.
*   **Unfinished AI Logic:** `app/api/ai/gemini/route.ts` is filled with TODOs for context injection and model selection for Pro/Business plans.
*   **Bootstrap Admin Risk:** `lib/auth.ts` uses `existingUsers === 0` to assign admin status. This is a race condition risk during initial launch if multiple users register simultaneously.

### 3.4. Security & Data Privacy
*   **OIDC Client Secret Defaults:** `lib/oidc-provider.ts` hardcodes `"typebot-secret"` as a default if the env var is missing.
*   **Strict-Transport-Security:** Header is set in `next.config.ts`, which is good, but `X-Frame-Options` is set to `SAMEORIGIN`, which might conflict with the Webchat widget if it's served via an iframe (though the current implementation seems to be a script-based DOM injection).

### 3.5. UX / Performance
*   **React Hook Violations:** 74 linting issues. Specifically:
    *   `react-hooks/set-state-in-effect`: Found in `components/chart-area-interactive.tsx`, `components/conversation/conversation-header.tsx`, and `hooks/use-mobile.ts`. This causes cascading renders and performance degradation.
    *   `react-hooks/purity`: Impure function `Date.now()` called during render in `conversation-header.tsx`.
*   **Incomplete Onboarding:** `lib/onboarding-flow-handler.ts` has many hardcoded messages/logics that seem tightly coupled to a specific Facebook flow, potentially conflicting with the new "Orchestra" model.

---

## 4. Severity & Impact Assessment

| Issue | Severity | Impact |
| :--- | :--- | :--- |
| Missing OIDC Interaction UI | **CRITICAL** | Typebot login/registration fails entirely. |
| Placeholder Email Service | **CRITICAL** | No password resets, no lead alerts. |
| Webchat Engine `getTime()` crash | **HIGH** | Webchat sessions crash for returning visitors. |
| Lint Errors (SetState in Effect) | **MEDIUM** | Performance lag and potential infinite loops in UI. |
| Missing `.env.example` | **MEDIUM** | Deployment difficulty and configuration drift. |

---

## 5. Actionable Recommendations

### Phase 1: Absolute Blockers (Must fix before any deployment)
1.  **Implement OIDC Interaction Routes:** Create `app/api/oidc/interaction/[uid]/route.ts` and accompanying UI to handle OIDC login/consent.
2.  **Integrate Production Email:** Connect `lib/email.ts` to Resend, SendGrid, or AWS SES.
3.  **Fix Webchat Crash:** Patch `lib/webchat-conversation-engine.ts` to safely handle `updatedAt` and fix the failing vitest.
4.  **Create `.env.example`:** Document all 100+ environment variables.

### Phase 2: Stability & Polish
1.  **Resolve Lint Errors:** Fix the 74 linting issues, prioritizing `set-state-in-effect`.
2.  **Refine Admin Bootstrapping:** Move `isAdmin` assignment to a dedicated seed script or environment variable check instead of `count() === 0`.
3.  **Complete AI Context Injection:** Implement the TODOs in `app/api/ai/gemini/route.ts` to ensure Pro/Business users get the value they pay for.

---

## 6. Final Decision: NO-GO

**Rationale:**
The platform's core value proposition (Unified Inbox + Typebot Integration) is currently broken at the infrastructure level (OIDC). Furthermore, essential SaaS operations like emailing and stable webchat sessions are incomplete or buggy. Launching in this state would lead to immediate churn and technical support overload.

**Requirement for Go-Live:**
Successful completion of all **Phase 1 Absolute Blockers** and a 100% pass rate on `pnpm run lint` and `pnpm run test`.
