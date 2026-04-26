# WhatsApp Integration Inspection Report

**Project:** Replybase SaaS
**Date:** April 2026
**Status:** Hardened but Incomplete
**Auditor:** Jules (Senior Software Engineer)

---

## 1. Executive Summary

The WhatsApp integration is architecturally robust, supporting multiple providers (Meta Cloud API, Twilio, 360dialog) and utilizing AES-256-GCM for credential encryption. It handles multi-tenancy well and includes a strong atomic de-duplication mechanism. However, the implementation is currently limited to text-only messages and lacks critical support for WhatsApp Business Templates (HSM), making it impossible for agents to respond to customers after the 24-hour service window has expired.

**Overall Assessment:** **7/10** (Well-engineered foundations, but functionally limited for professional support use-cases).

---

## 2. Detailed Findings

### 2.1 Security & Data Integrity

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Missing `appsecret_proof` for Meta Cloud API** | `lib/whatsapp-provider.ts:101` | **High** |
| **No Signature for 360dialog** | `lib/whatsapp-provider.ts:153` | Medium |
| **Strong Credential Encryption** | `lib/whatsapp-channel-credentials.ts` | **Pass** |
| **Atomic Message De-duplication** | `app/api/whatsapp/webhook/route.ts:251` | **Pass** |

**Details:**
- **Security Gap:** The WhatsApp Meta Cloud API validation and message sending calls do not use `appsecret_proof`. This prevents the use of Meta's "Require App Secret" security feature.
- **Encryption:** The use of AES-256-GCM for storing provider credentials is a high-standard implementation.
- **De-duplication:** The atomic use of `WebhookLog` with a unique constraint effectively prevents double-replies from concurrent webhook retries.

### 2.2 API Compliance & Versioning

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Deprecated Version (v20.0)** | `lib/whatsapp-provider.ts:39` | Medium |
| **24-Hour Window Enforcement** | `lib/conversation-channel-delivery.ts` | **Pass** |

**Details:**
- **Versioning:** Using `v20.0`. While newer than the Facebook integration (v18.0), it should be updated to `v21.0` to ensure longevity.
- **Compliance:** The 24-hour service window is correctly enforced for manual replies, preventing policy violations that could lead to number banning.

### 2.3 Feature Gaps (Impact on Compliance)

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **No Template Message (HSM) Support** | N/A | **Critical** |
| **No Media Support** | `app/api/whatsapp/webhook/route.ts:468` | Medium |
| **No Interactive Message Support** | `app/api/whatsapp/webhook/route.ts:468` | Low |

**Details:**
- **HSM Gap:** Because HSM templates are not supported, agents are "locked out" of conversations once the 24-hour window expires. This is a major friction point for SMEs who may not check the dashboard every day.
- **Media Support:** Inbound images/documents are ignored. In UK service industries (e.g., tradespeople), receiving photos of issues is a core requirement.

### 2.4 Multi-tenancy

| Finding | File/Line | Severity |
| :--- | :--- | :--- |
| **Secure Tenant Isolation** | `app/api/whatsapp/connect/route.ts:80` | **Pass** |

**Details:**
- The connection flow correctly scopes bots and channels to the authenticated user's tenant, preventing cross-tenant access.

---

## 3. Severity & Impact Assessment

| Severity | Impact |
| :--- | :--- |
| **Critical** | Service becomes unusable for long-tail conversations due to lack of HSM support. |
| **High** | Security risk for Meta Cloud API users if App Secret hardening is desired. |
| **Medium** | Limited functionality (text-only) may reduce product value for certain industries. |

---

## 4. Actionable Recommendations

### Priority 1: Functional Completeness (Immediate)
1. **Implement Template Support:** Add the ability to sync and send Meta-approved WhatsApp templates to allow re-engaging customers after 24 hours.
2. **Support App Secret Proof:** Update `lib/whatsapp-provider.ts` to include `appsecret_proof` in all Meta Cloud API requests.

### Priority 2: Reliability & Versioning
1. **Update API Version:** Upgrade to `v21.0` for all Meta Cloud API calls.
2. **Media Handling:** Add basic support for receiving media (log the attachment URL in the CRM, even if not displayed in the UI yet).

### Priority 3: Monitoring
1. **Usage Quotas:** WhatsApp Business API can be expensive. Implement tenant-level usage monitoring for WhatsApp specifically (beyond generic message counts).

---

## 5. Final Assessment
**Production Readiness:** **BETA READY.**
The WhatsApp integration is architecturally sound but feature-poor. It is safe for production use in terms of data security and multi-tenancy, but it will frustrate users who cannot reply to old conversations. It is recommended to label this as "Beta" until HSM template support is added.
