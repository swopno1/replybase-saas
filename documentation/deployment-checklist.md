---
title: Production Deployment Checklist
description: Use this checklist to track deployment readiness
---

# Production Deployment Checklist

Use this checklist to track deployment readiness

## Pre-Deployment Setup
- SSH access and Coolify dashboard access
- Database URL ready
- Google & Facebook OAuth apps configured
- Stripe account and webhook configured
- Domains and SSL verified

## Environment Variables
- OIDC keys generated and stored securely
- AUTH_SECRET and TYPEBOT secrets generated
- OAuth client IDs and secrets configured
- Stripe keys and price IDs set
- DATABASE_URL verified

## Database Setup
- Prisma migrations applied
- Tables verified
- Stripe plans seeded

## Typebot Configuration
- OIDC provider enabled
- Public auth disabled (Google/Facebook/Email)
- Subscription checks enforced
- Engine restarted

## Testing & Launch
- OIDC endpoints verified
- Subscription flow tested
- Webhook events validated
- Health checks passing

[Quick Start Guide](/docs/quick-start)
