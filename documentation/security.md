---
title: Security Model (Application-Level)
description: Secure access enforced via OIDC token validation
---

# Security Model (Application-Level)

Secure access enforced via OIDC token validation

ReplyBase uses application-level security. The SaaS app issues OIDC tokens and the Typebot Engine validates them for every request. No Nginx rules are required.

## How It Works
- SaaS app issues OIDC tokens with subscription status claims
- Typebot Engine validates token signature via JWKS
- Issuer and audience are strictly verified
- Subscription status must be active or trialing
- Expired or invalid tokens receive 401 responses

## What's Protected
- Builder access restricted to authenticated users
- Subscription checks enforce paid access
- Tokens expire after 1 hour by default
- All requests are validated at the application layer

## Why This Is Secure
- OIDC tokens are cryptographically signed
- Issuer/audience checks prevent token misuse
- Subscription status is enforced on every request
- No reliance on infrastructure-level rules

[Typebot Configuration](/docs/typebot-config)
