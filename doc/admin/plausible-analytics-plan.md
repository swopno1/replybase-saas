# Plausible Analytics Implementation Plan: Admin Panel

## Overview
To ensure data-driven decision-making and optimal performance of the Replybase Admin panel, it is essential to implement robust, privacy-first analytics. We will utilize a self-hosted instance of Plausible Analytics located at `https://engine.replybase.co.uk/`. This approach ensures full ownership of data while maintaining high performance and user privacy.

---

## Step-by-Step Integration Plan

### 1. Script Configuration & Loading
The Plausible script will be loaded via the existing `AnalyticsScripts` component to ensure consistency across the platform.

- **Source URL:** `https://engine.replybase.co.uk/js/script.js`
- **Domain Identifier:** `app.replybase.co.uk`
- **Loading Strategy:** Use the Next.js `<Script>` component with `strategy="afterInteractive"` and the `defer` attribute to prevent any impact on initial page load times.
- **Environment Targeting:** The script will strictly load only in the `production` environment and only when the hostname matches the official production domain.

### 2. Event Tracking Strategy
We will implement a dual-layer tracking strategy: automatic pageviews and targeted custom events.

#### Pageview Tracking
- All transitions within the `/admin` route will be automatically tracked as pageviews by the Plausible script.

#### Custom Admin Actions
Specific administrative actions will be tracked using the `trackEvent` utility:
- `admin_user_promoted`: Triggered when a user is granted admin privileges.
- `admin_user_demoted`: Triggered when admin privileges are revoked.
- `admin_subscriber_deleted`: Triggered when a subscription is manually removed.
- `admin_kpi_check`: Triggered when the system health dashboard is accessed.
- `admin_error_viewed`: Triggered when an admin views detailed error logs.

### 3. Security & Privacy Considerations
- **No PII (Personally Identifiable Information):** We will never send user emails, names, or tenant-specific identifiers to Plausible.
- **Access Control:** The analytics dashboard itself will be protected by IP whitelisting or shared-link authentication to prevent unauthorized access to platform metrics.
- **Cookie-less:** Plausible does not use cookies, ensuring compliance with GDPR and PECR without requiring intrusive cookie banners for the admin panel.

### 4. Validation & Monitoring
To ensure the accuracy and reliability of the implementation:
- **Real-time Verification:** Use the Plausible dashboard's "Real-time" view during the staging phase to verify event triggers.
- **Automated Health Checks:** Implement a weekly automated check to ensure the Plausible script is still loading correctly on the production site.
- **Data Reconciliation:** Periodically compare Plausible metrics (e.g., total active subscribers) against the primary database to ensure high-level data consistency.

---

## Implementation Timeline

| Phase | Task | Responsibility |
|-------|------|----------------|
| **Phase 1** | Configuration of Environment Variables | DevOps / Backend |
| **Phase 2** | Implementation of Custom Event Triggers | Frontend Engineer |
| **Phase 3** | Quality Assurance & Data Validation | QA Team |
| **Phase 4** | Full Production Rollout | Platform Lead |

---

## Responsibilities
- **Frontend Engineering:** Responsible for the implementation of the `trackEvent` calls within the admin components.
- **DevOps:** Responsible for maintaining the uptime and security of the self-hosted Plausible engine (`engine.replybase.co.uk`).
- **Product Management:** Responsible for defining new KPIs and goals to be tracked within the analytics suite.
