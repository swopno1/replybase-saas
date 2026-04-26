# ReplyBase Data Deletion API: Architecture & Recommendations

## Overview

ReplyBase provides a GDPR-compliant data deletion workflow for users and integrations. The system is designed to:

- Allow users (or integrations) to request deletion of their data.
- Track the status of each deletion request.
- Provide a status endpoint and UI for transparency.
- Support both direct user requests and Facebook integration.
- Automate deletion processing and audit all actions for compliance.

---

## API Endpoints

### 1. Create Data Deletion Request

- **Route:** `/api/data-deletion/request` (POST)
- **Auth:** API key (for marketing site) or user session (for SaaS app)
- **Input:** `{ email, source }` (email required, or taken from session)
- **Process:**
  - Validates email.
  - Creates a `DataDeletionRequest` record with a unique confirmation code and a 7-day grace period.
  - Returns a status URL for tracking.
- **Security:**
  - Requires valid API key or authenticated session.
  - Rate limiting is enforced to prevent abuse.
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
  - Creates a `DataDeletionRequest` for the Facebook user.
  - Returns a status URL.
- **Security:**
  - Validates Facebook secret and signed request.

### 4. Automated Deletion Processing (CRON)

- **Route:** `/api/cron/process-data-deletions` (GET, internal/CRON)
- **Auth:** Bearer token (`CRON_SECRET`)
- **Process:**
  - Processes pending requests in batches.
  - Updates status to IN_PROGRESS and then COMPLETED.
  - Cleans up user/tenant/Facebook data as appropriate.
  - Alerts for stuck/failed requests.
  - Logs all actions to the audit log.

---

## Status Page

- **Route:** `/data-deletion-status` (UI)
- **Input:** `?code=CONFIRMATION_CODE`
- **Process:**
  - Looks up the request and displays status.
  - Handles missing/invalid codes gracefully.
  - Provides links to Privacy Policy and Terms of Service.

---

## Audit Logging

- All deletion actions are logged in both the `ActivityLog` (for tenant/user context) and `AdminActivity` (for admin actions).
- Logs include who performed the action, what was deleted, when, and relevant metadata.

---

## Notifications

- (Planned) Email notifications to users when their request is received and when completed.

---

## Rate Limiting

- Rate limiting middleware is available and should be applied to prevent abuse of the deletion endpoints.

---

## Admin Dashboard

- (Planned) Internal UI for staff to review, approve, or reject requests, and view audit logs.

---

## Testing

- Integration and cron job tests exist to ensure deletion requests are processed, statuses are updated, and audit logs are created.

---

## Recommendations & Improvements

1. **Automated Deletion:**

- Fully implemented via scheduled CRON job and batch processing.

2. **Notifications:**

- Implement user email notifications for request receipt and completion.

3. **Audit Logging:**

- Already implemented for all deletion actions.

4. **Rate Limiting:**

- Enforced via middleware.

5. **Admin Dashboard:**

- Build a UI for staff to review and manage requests.

6. **API Hardening:**

- Continue to review endpoints for abuse and information leakage.

7. **Documentation:**

- Keep this document up to date and link from internal onboarding docs.

8. **Monitoring:**

- Add monitoring/alerting for stuck or failed deletion requests.

9. **Data Reconciliation:**

- Periodically reconcile deletion logs with actual data for compliance.

---

## Flow Diagram

1. User or integration submits deletion request (API or Facebook)
2. System creates a `DataDeletionRequest` record
3. User receives confirmation/status URL
4. Background job processes deletion (automated)
5. User checks status via status page or API
6. (Planned) User notified on completion

---

**Current Gaps:**

- User notification on completion is not yet implemented.
- Admin review UI is planned but not yet live.
- Ongoing need for monitoring and reconciliation.

**Summary:**  
The ReplyBase data deletion API is secure, automated, and compliant for request tracking and status, with audit logging and rate limiting in place. Next steps are to add user notifications, an admin dashboard, and enhanced monitoring for full GDPR/CCPA compliance.
