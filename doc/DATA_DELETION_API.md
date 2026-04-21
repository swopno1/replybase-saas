# ReplyBase Data Deletion API: Architecture & Recommendations

## Overview

ReplyBase provides a GDPR-compliant data deletion workflow for users and integrations. The system is designed to:

- Allow users (or integrations) to request deletion of their data.
- Track the status of each deletion request.
- Provide a status endpoint and UI for transparency.
- Support both direct user requests and Facebook integration.

## API Endpoints

### 1. Create Data Deletion Request

- **Route:** `/api/data-deletion/request` (POST)
- **Auth:** API key (for marketing site) or user session (for SaaS app)
- **Input:** `{ email, source }` (email required, or taken from session)
- **Process:**
  - Validates email.
  - Creates a `dataDeletionRequest` record with a unique confirmation code.
  - Returns a status URL for tracking.
- **Security:**
  - Requires valid API key or authenticated session.
  - Logs errors and rejects invalid requests.

### 2. Data Deletion Status

- **Route:** `/api/data-deletion/status` (GET)
- **Input:** `?code=CONFIRMATION_CODE`
- **Process:**
  - Looks up the request by confirmation code.
  - Returns status, requestedAt, processedAt.
- **Security:**
  - Only exposes status, not sensitive data.

### 3. Facebook Data Deletion

- **Route:** `/api/facebook/data-deletion` (POST)
- **Input:** Facebook `signed_request` (form data)
- **Process:**
  - Validates Facebook channel and signature.
  - Creates a `dataDeletionRequest` for the Facebook user.
  - Returns a status URL.
- **Security:**
  - Validates Facebook secret and signed request.

## Status Page

- **Route:** `/data-deletion-status` (UI)
- **Input:** `?code=CONFIRMATION_CODE`
- **Process:**
  - Looks up the request and displays status.
  - Handles missing/invalid codes gracefully.

## Recommendations & Improvements

1. **Automated Deletion:**
   - Implement a background job to process and fulfill deletion requests (remove user data, anonymize, etc.).
   - Update `status` and `processedAt` fields when complete.
2. **Notifications:**
   - Email users when their request is received and when completed.
3. **Audit Logging:**
   - Log all deletion actions for compliance.
4. **Rate Limiting:**
   - Prevent abuse by limiting requests per user/IP.
5. **Admin Dashboard:**
   - Internal UI for staff to review, approve, or reject requests.
6. **API Hardening:**
   - Ensure all endpoints are protected against abuse and information leakage.
7. **Documentation:**
   - Keep this document up to date and link from internal onboarding docs.

## Flow Diagram

1. User or integration submits deletion request (API or Facebook)
2. System creates a `dataDeletionRequest` record
3. User receives confirmation/status URL
4. (Future) Background job processes deletion
5. User checks status via status page or API
6. (Future) User notified on completion

---

**Current Gaps:**

- No automated deletion job (manual or future work)
- No user notification on completion
- No admin review UI

**Summary:**
The ReplyBase data deletion API is secure and compliant for request tracking and status, but should be extended with automation, notifications, and admin controls for full GDPR/CCPA compliance.
