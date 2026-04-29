# Advanced Subscriber Management Roadmap

This roadmap outlines planned features to enhance user and subscription management for administrators within the Replybase system.

## Phase 1: Search, Filter, & Metrics
- **Advanced Filtering & Sorting:** Add capabilities to filter by specific plans (e.g., Starter vs Pro), exact subscription status, MRR impact, and renewal dates. Implement sortable table columns.
- **Key Metrics Dashboard:** Display vital subscription metrics directly on the subscribers page: Total Paid Subscribers, Churn Rate (monthly/annual), Monthly Recurring Revenue (MRR), and Active Trials.

## Phase 2: Detailed User Profiles & Admin Actions
- **Detailed Profiles:** When an admin clicks to view a subscriber, display a rich profile showing complete subscription history, past payment events (successes/failures via Stripe webhooks), and usage limit consumption.
- **Manual Subscription Management:** Enable admins to securely trigger upgrades, downgrades, or cancellations on behalf of the customer via integration with the billing provider.

## Phase 3: Reporting & Exports
- **Data Export:** Implement robust export functionality (CSV/Excel) for subscriber lists to support external reporting, marketing, and accounting needs.
- **Audit Logging:** Ensure every admin action (e.g., manual cancellation, forced upgrade) is rigorously logged in the `ActivityLog` table to maintain compliance and auditability.

## Phase 4: Proactive Alerts & Communication
- **Billing Alerts:** Surface real-time alerts in the admin panel for failed payments, expiring credit cards, or significant upcoming renewals (especially for annual or enterprise plans).
- **Quick Communication Links:** Provide quick action buttons to instantly contact subscribers, trigger onboarding flows, or resend welcome/password reset emails directly from the subscriber management interface.

## Technical Considerations
- **Stripe Integration:** Deepen integration with Stripe to rely more on real-time API queries for billing actions to avoid purely relying on cached webhook state.
- **Permissions:** Ensure all manual upgrade/downgrade endpoints are strictly guarded by `isPlatformAdmin` checks and potentially require multi-factor authentication or secondary confirmation for destructive actions.
