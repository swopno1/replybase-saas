# Analytics and Monitoring Implementation Guide

This guide documents the production analytics stack for ReplyBase SaaS and how to operate it on a self-hosted DigitalOcean + Coolify setup.

## 1. Implemented stack

- Plausible Analytics (self-hosted-ready)
- Microsoft Clarity (session recordings + heatmaps)
- Google Search Console verification support
- Lighthouse and WebPageTest workflow scripts
- Optional PostHog event sink for deeper product analytics

## 2. What is implemented in code

### Global script loading (non-blocking)

Scripts are loaded globally in the root layout via Next Script strategies:

- Plausible: afterInteractive + defer
- Clarity: afterInteractive
- PostHog: lazyOnload (optional)

Files:
- app/layout.tsx
- components/analytics/analytics-scripts.tsx

### Centralized event tracking utility

A reusable TypeScript utility sends events to all enabled providers and supports deduplication:

- trackEvent(eventName, options)
- setClarityTags(tags)

Dedup scopes:
- memory (avoid duplicate fire in a render cycle)
- session (once per tab session)
- local (once across browser sessions)

File:
- lib/client-analytics.ts

### Funnel events wired

Implemented events:
- get_started_click
- signup_started
- signup_completed
- onboarding_step_completed
- dashboard_loaded
- pricing_viewed

Files:
- app/(dashboard)/pricing/page.tsx
- app/auth/register/page.tsx
- app/(dashboard)/page.tsx
- components/analytics/dashboard-funnel-tracker.tsx

### Clarity page tagging

Clarity custom tags set for key pages/funnel steps:
- pricing page: page_type=pricing, funnel_step=landing
- signup page: page_type=signup, funnel_step=signup
- dashboard page: page_type=dashboard, funnel_step=dashboard

## 3. Plausible self-hosted on Coolify

A compose template is included:

- extra/ops/plausible/docker-compose.coolify.yml

Create a .env.plausible file next to the compose with:

- BASE_URL=https://analytics.replybase.co.uk
- SECRET_KEY_BASE=<64+ char random>
- POSTGRES_PASSWORD=<strong password>
- CLICKHOUSE_PASSWORD=<strong password>

Coolify setup notes:
1. Create a new Docker Compose resource and point to the compose file.
2. Attach analytics.yourdomain.com to the plausible service.
3. Enable HTTPS at the Coolify proxy level.
4. Ensure DNS A/AAAA records point analytics.yourdomain.com to your server.
5. In Plausible UI, add app.replybase.co.uk as a site domain.

## 4. Plausible goals mapping

The tracker maps these events to Plausible custom goals automatically:

- get_started_click -> Get Started Click
- signup_completed -> Signup Completed
- pricing_viewed -> Pricing Viewed

Create these goals in Plausible UI:
- Goal name: Get Started Click
- Goal name: Signup Completed
- Goal name: Pricing Viewed

UTM/referrer/pageview are collected by Plausible script automatically.

## 5. Google Search Console checklist

1. Add app.replybase.co.uk property in GSC.
2. Verification options:
   - Preferred: DNS TXT record (works across deployments)
   - Optional: HTML meta tag using NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
3. Submit sitemap: https://app.replybase.co.uk/sitemap.xml
4. Monitor Coverage and Core Web Vitals.

SEO files to verify:
- app/layout.tsx
- app/sitemap.ts
- app/robots.ts

## 6. Performance workflow

Scripts added:
- npm run perf:lighthouse
- npm run perf:webpagetest

Recommended runbook:
1. Run lighthouse on production URL after each release.
2. Run WebPageTest mobile + desktop before major homepage/pricing/auth changes.
3. Keep analytics scripts async/deferred only.

Target gates:
- Lighthouse Performance > 90
- Lighthouse SEO > 90

## 7. Suggested file structure

- components/analytics/
  - analytics-scripts.tsx
  - dashboard-funnel-tracker.tsx
- lib/
  - client-analytics.ts
- extra/
  - ANALYTICS_MONITORING_SETUP.md
  - ops/plausible/docker-compose.coolify.yml

## 8. Common mistakes to avoid

1. Double-loading analytics scripts in both layout and individual pages.
2. Emitting completion events without dedup keys (inflates conversion rates).
3. Tracking PII (email/full name) in event properties.
4. Blocking render by placing third-party scripts synchronously in head.
5. Forgetting to create matching Plausible goal names in the Plausible UI.
