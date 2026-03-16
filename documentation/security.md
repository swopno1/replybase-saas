---
title: Security Model (Application-Level)
description: How ReplyBase currently protects accounts, tenants, admin tools, billing, and webchat traffic
---

# Security Model (Application-Level)

ReplyBase uses layered application security across authentication, tenant isolation, admin access, billing, and public channel endpoints.

## 1. Authentication And Tenant Isolation

- users authenticate through NextAuth-backed flows
- registration creates a dedicated tenant workspace automatically
- most protected APIs require both a valid session and a tenant association
- tenant ownership checks are applied before returning or mutating tenant-scoped resources

## 2. Secure Builder Access

ReplyBase uses a controlled launch flow for bot builder access.

- users do not open the external builder directly from arbitrary URLs
- ReplyBase checks authentication and subscription state first
- only eligible users receive the builder authorization redirect

## 3. Billing Protection

- billing endpoints require an authenticated user session
- subscription lookups are tenant-scoped
- customer portal access is created server-side through Stripe
- plan limits are checked before certain resource creation flows such as bot creation

## 4. Admin Access

- admin pages are guarded server-side
- admin APIs perform their own authorization checks
- admin access is currently tied to a single allowlisted identity in code
- non-admin requests are redirected or rejected with `403`

## 5. Webchat Protection

The webchat stack has the strongest explicit public-endpoint hardening in the product today.

- short-lived signed session tokens
- origin and referer validation
- allowed-domain enforcement per site
- rate limiting on init, message, and events
- replay-resistant init challenge handling
- bot mitigation checks
- configurable PII retention behavior
- rollout gating for staged enablement

## 6. Data And Compliance Utilities

- newsletter subscribe and unsubscribe flows support both app-session and API-key access where intended
- account data deletion requests are recorded through dedicated endpoints
- Facebook data deletion support exists as part of the compliance surface

## Practical Security Posture

What is strongest today:

- session and tenant checks on protected APIs
- webchat public endpoint defenses
- subscription-aware builder and billing flows

What still needs follow-through:

- broader production observability for some non-webchat areas
- more complete real usage accounting behind plan enforcement
- continued removal of hardcoded admin configuration in favor of managed environment-based access

[Typebot Configuration](/docs/typebot-config)
