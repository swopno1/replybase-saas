---
title: Admin Panel
description: Internal admin tools for operations, rollout control, and subscription oversight
---

# Admin Panel

The admin panel is an internal operational area, not a customer-facing workspace section.

Access is enforced server-side and is currently limited to a single allowlisted admin identity in code.

## Key Features

- **Business Status**: high-level metrics for users, tenants, subscriptions, bots, contacts, conversations, and onboarding conversion.
- **Subscribers**: internal subscription management, plan changes, and lifecycle operations.
- **Onboarding**: visibility into onboarding sessions, stage distribution, abandonment, and conversion.
- **Webchat Rollout**: rollout mode controls for staged webchat exposure.

## Security Controls

- admin layout access is guarded server-side
- admin APIs independently verify the operator before returning data
- non-admin users are redirected away from admin pages or receive `403` responses from admin endpoints

## Current Admin Navigation

The internal admin navigation currently includes:

- Business Status
- Subscribers
- Onboarding
- Webchat Rollout

## What Admin Can See Today

- monthly revenue derived from active and trialing subscriptions
- recent subscription signups
- onboarding completion and abandonment metrics
- staged webchat release settings for `off`, `pilot`, `tiered`, and `ga` rollout modes

## Notes

- The admin area is intentionally separate from the main customer navigation.
- This area is suitable for internal operations, support, and rollout management, not end-user self-service.

[Onboarding Docs](/docs/onboarding)
