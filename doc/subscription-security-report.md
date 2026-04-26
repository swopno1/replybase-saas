# Subscription Management, Usage Limit, and Data Security Report

## Executive Summary
This report provides a comprehensive evaluation of the Replybase SaaS codebase regarding subscription management, usage enforcement, and data security. It identifies current implementations, highlights risks, and offers actionable recommendations for improvement.

---

## 1. Subscription & Package Management

### Current Model & Package Tiers
Replybase uses a multi-tenant subscription model where each `Tenant` is associated with a `Subscription` and a `Plan`.

**Current Tiers (defined in `prisma/schema.prisma` and `lib/stripe.ts`):**
- **Free**: 100 daily messages, 3,000 monthly messages, 100 flow executions, 1 bot, 3 flows.
- **Starter**: Enhanced limits ($29/mo).
- **Pro**: High-volume limits ($89/mo).
- **Business**: Enterprise-grade limits ($249/mo).

### Tracking & Infrastructure
- **Database**: The `Subscription` model tracks `status` (active, trialing, past_due, canceled), `currentPeriodEnd`, and `cancelAtPeriodEnd`.
- **Stripe Integration**: `lib/stripe.ts` configures the Stripe SDK. Subscription state is synchronized via webhooks (`app/api/billing/webhook/route.ts`).
- **Plan Limits**: The `Plan` model stores hard limits for bots, channels, messages, and flows. `lib/subscription.ts` provides utility functions like `getTenantLimits` to retrieve these.

### Lifecycle Management
- **Upgrades/Downgrades**: Handled via Stripe Checkout and Customer Portal. The webhook `syncSubscription` function updates the local `Subscription` and `planId` based on Stripe events.
- **Renewals**: Managed by Stripe; webhook updates `currentPeriodEnd`.
- **Cancellations**: Handled via Stripe; `cancelAtPeriodEnd` is synced to ensure access remains until the end of the billing cycle.

### Gaps & Risks
- **JWT Stale State**: `subscriptionStatus` is cached in the NextAuth JWT (`lib/auth.ts`). If a subscription is canceled or expires, the user might retain access until their session expires or they re-log.
- **Webhook Reliability**: The current `syncSubscription` logic relies on metadata (`app_plan_id`) in the Stripe Product. If this metadata is missing or mismatched, sync fails.
- **Plan Defaults**: A "Free" plan is automatically created/assigned during login if no subscription exists, which is convenient but can lead to "plan sprawl" in the database if not strictly managed.

---

## 2. Usage Limit Enforcement

### Measurement & Recording
Usage is tracked in the `UsageLog` table, which aggregates counts by `tenantId`, `type` (message, flow_execution), and `date`.
- **Message Tracking**: Incremented whenever an AI message is sent (`app/api/ai/chat/route.ts`).
- **Flow Executions**: Incremented when a bot flow is triggered.
- **Persistence**: `lib/subscription.ts` uses `prisma.usageLog.upsert` to ensure atomicity and daily granularity.

### Enforcement Logic
- **Rate Limiting**: `lib/rate-limit.ts` implements a middleware that calls `checkLimit`.
- **Blockage**: If `checkLimit` returns `allowed: false`, the system returns an HTTP 429 (Too Many Requests) with details on when the limit resets.
- **Granularity**: The system checks both daily and monthly message limits, failing closed if either is exceeded.

### Notification Flow (Recommendations)
**Currently, the system lacks proactive notifications.**
- **Industry Standard Threshold**: **80% Usage**.
    - *Justification*: Provides enough lead time for users to upgrade before service interruption without being overly intrusive.
- **Proposed Flow**:
    1. **80% Threshold**: Trigger an in-app banner and an automated email notifying the admin of high usage.
    2. **95% Threshold**: Urgent warning email with a direct upgrade link.
    3. **100% Threshold**: Service suspension notification with instructions on how to resume service.

### Upsell Process
- **Triggers**: Upsells should be triggered when a user attempts to create a bot/flow beyond their limit or when they hit the 80% usage threshold.
- **Implementation**: The `RateLimitResult` already includes `limit` and `remaining` values, which should be utilized by the frontend to display contextual "Upgrade Plan" buttons.

---

## 3. User Data Security

### Storage & Encryption
- **Data at Rest**: Sensitive credentials (e.g., WhatsApp API keys, Facebook tokens) are encrypted using **AES-256-GCM** via `lib/channel-credentials-crypto.ts`.
- **Encryption Key**: Uses `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` falling back to `AUTH_SECRET`.
- **Passwords**: Hashed using secure algorithms in `lib/server/password.ts`.
- **Transit**: All traffic is expected to be over HTTPS (standard for Next.js/Vercel deployments).

### Access Controls & Isolation
- **Multi-Tenancy**: Enforced at the database level using `tenantId`.
- **Route Protection**: `lib/route-helpers.ts` provides `withAuthAndTenant` to ensure users only access data belonging to their workspace.
- **Admin Isolation**: Platform admins are distinguished by the `isAdmin` flag, with specific routes under `/admin` restricted via `isPlatformAdmin` checks.

### Audit Logging
- **Activity Log**: The `ActivityLog` model records events like `subscription_updated`, `settings_updated`, and `login`.
- **Execution Logs**: Bot interactions are logged in `ExecutionLog` for debugging and transparency.

### Potential Gaps & Compliance Risks
- **Account Linking**: `allowDangerousEmailAccountLinking: true` is enabled in `lib/auth.ts`. This poses a risk where an attacker could take over an account by creating a social account with the same email if the provider is not trusted.
- **GDPR/CCPA**: While `DataDeletionRequest` models exist, a formal "Right to Access" (Data Export) mechanism is missing.
- **Email Security**: The `email.ts` service is currently a placeholder. Password reset links are logged to the console, which is a major security risk in production.

---

## 4. Recommendations & Best Practices

### Short-Term Improvements (Security & Stability)
1. **Secure Account Linking**: Set `allowDangerousEmailAccountLinking: false` and implement a manual linking flow for verified users.
2. **Production Email Service**: Replace the `email.ts` placeholder with a provider like Resend or SendGrid immediately.
3. **JWT Sync**: Implement a mechanism to re-validate subscription status in the JWT more frequently or use a session-side check for critical actions.

### Medium-Term Improvements (Usage & Growth)
1. **Automated Notifications**: Implement a background job (Cron) that checks usage daily and sends 80%/100% alerts.
2. **Usage Dashboard**: Expose the `UsageLog` data to users in a "Billing & Usage" dashboard so they can monitor their own consumption.
3. **Grace Periods**: Implement a 5-10% "grace buffer" for loyal customers to avoid hard-stops at exactly 100%.

### Automation & Monitoring
- **Tools**: Use **Stripe Tax** and **RevenueCat** (if expanding to mobile) for better subscription analytics.
- **Monitoring**: Integrate **Sentry** or **LogRocket** to monitor subscription-related errors in real-time.

### Documentation Maintenance
- This document should be reviewed quarterly or after any major architectural change to the billing or security modules.
- Maintain a `CHANGELOG.md` specifically for security-related patches.

---
*Report generated on March 2024 for Replybase Engineering.*
