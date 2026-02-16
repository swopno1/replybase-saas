---
title: Admin Panel
description: Internal admin tools for business metrics and subscriber management
---

# Admin Panel

Internal admin tools for business metrics and subscriber management

The admin panel is a protected internal area available only to authorized administrators. Access is enforced server-side via a hardcoded admin email in the app layout.

## Key Features

- Business status dashboard (users, tenants, revenue, bots, contacts)
- Subscriber management with search, filters, and plan updates
- Subscription status editing and cancellation controls
- Protected admin APIs for subscribers and plan data

## Security Controls

- Server-side email verification on every admin request
- Admin routes are not linked in navigation
- All admin APIs return 403 for non-admin users

[Onboarding Docs](/docs/onboarding)
