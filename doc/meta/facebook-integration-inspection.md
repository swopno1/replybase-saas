# Facebook Integration Inspection Report

**Project:** Replybase SaaS
**Date:** April 2026
**Status:** Needs Hardening
**Auditor:** Jules (Senior Software Engineer)

---

## 1. Executive Summary

The Facebook integration in Replybase is functional and supports multi-tenant Page connections, webhook-based message receiving, and manual/automated replies. However, the implementation has significant security gaps regarding Meta's "Require App Secret" setting and relies on deprecated API versions. Additionally, while the mandatory Data Deletion Callback is implemented, the actual deletion of user data is not yet automated.

**Overall Assessment:** **6/10** (Usable, but not compliant with high-security production standards).

---

## 2. Detailed Findings

### 2.1 Security & Authentication

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Missing `appsecret_proof` in Webhook Profile Fetch** | `app/api/facebook/webhook/route.ts:182` | **High** |
| **Inconsistent `appsecret_proof` usage** | Various | Medium |
| **Webhook Signature Verification Optional** | `app/api/facebook/webhook/route.ts:89` | Medium |

**Details:**
- **Profile Fetch Vulnerability:** The webhook handler fetches user names from Graph API without `appsecret_proof`. If "Require App Secret" is enabled in the Meta App Dashboard (a best practice), this call will fail.
- **Optional Signature:** The webhook signature verification falls back to processing without verification if `FACEBOOK_CLIENT_SECRET` is missing. In production, this should be a hard requirement to prevent spoofing.

### 2.2 API Compliance & Versioning

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Deprecated API Version (v18.0)** | `lib/facebook-sender.ts:7`, `app/api/integrations/facebook/pages/route.ts:25` | **High** |
| **Hardcoded API Versions** | Multiple files | Medium |

**Details:**
- **v18.0 Deprecation:** The codebase heavily uses v18.0. In April 2026, v18.0 is likely sunset. Meta typically sunsets versions after 2 years. v18.0 was released in late 2023.
- **Inconsistency:** Some newer code (onboarding) uses v19.0, while core integration uses v18.0. There is no centralized version management.

### 2.3 Data Privacy & Deletion

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Data Deletion Not Automated** | `app/api/facebook/data-deletion/route.ts` | Medium |
| **Data Deletion Status Page Minimal** | `app/data-deletion-status/page.tsx` | Low |

**Details:**
- **Manual Deletion:** The deletion callback correctly records the request but does not trigger any background job to actually delete the tenant's data or scrub the Facebook user's identities. Meta requires requests to be processed in a timely manner.

### 2.4 UI/UX & Branding

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Non-standard Branding** | `app/(dashboard)/integrations/facebook/page.tsx:289` | Low |
| **Missing Legal Links** | `app/(dashboard)/integrations/facebook/page.tsx` | Medium |

**Details:**
- **Branding:** The "Connect with Facebook" button uses a generic Lucide icon instead of official Meta/Facebook assets.
- **Compliance:** There are no visible links to Replybase's Privacy Policy or Terms of Service on the integration page, which is often required during Meta's App Review.

---

## 3. Severity & Impact Assessment

| Severity | Impact |
| :--- | :--- |
| **High** | Security failure if Meta's security hardening is enabled; Potential service disruption due to API version sunset. |
| **Medium** | Non-compliance with Meta App Review standards; Increased manual overhead for data privacy requests. |
| **Low** | Sub-optimal user trust due to branding inconsistencies. |

---

## 4. Actionable Recommendations

### Priority 1: Security & Compliance (Immediate)
1. **Centralize API Versions:** Move `FACEBOOK_GRAPH_API_VERSION` to a global config and update to at least `v21.0`.
2. **Mandate `appsecret_proof`:** Ensure every call to `graph.facebook.com` includes `appsecret_proof`. Specifically fix `app/api/facebook/webhook/route.ts`.
3. **Strict Signature Check:** Remove the fallback in the webhook handler. Throw an error if the signature is missing or invalid in production.

### Priority 2: Data Privacy
1. **Implement Deletion Job:** Create a background worker that processes `DataDeletionRequest` records marked as `PENDING`.
2. **Add Legal Links:** Insert links to Privacy Policy and Terms of Service in the Integration UI and the footer of the Data Deletion Status page.

### Priority 3: UI/UX Hardening
1. **Official Branding:** Use the official "Continue with Facebook" button assets provided by Meta.
2. **Setup Diagnostics:** Add a "Check Connection" button that verifies the Page Token and Webhook subscription status on demand.

---

## 5. Final Assessment
**Production Readiness:** **NOT FULLY READY.**
The integration is functional for a "soft launch" or beta but fails several "hard" production requirements for security and long-term stability. Fixing the API versions and `appsecret_proof` consistency is mandatory before scaling to a large number of UK SME customers.
