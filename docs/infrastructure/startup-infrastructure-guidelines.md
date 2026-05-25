# Startup Infrastructure Guidelines - ReplyBase

## Philosophy: Startup Pragmatism
ReplyBase optimizes for **low operational complexity** and **minimal cost** during the early SaaS phase. We avoid "Enterprise Architecture" until we have enterprise load.

## Final Recommendation
**OPTION B: Reduce Redis usage significantly.**

We will keep Redis for BullMQ (Critical for Social Webhooks) but avoid adding new Redis-dependent features.

### Recommended Strategy:
1. **Retain Redis for BullMQ:** Essential for Facebook/WhatsApp reliability and meeting provider response time constraints.
2. **Prefer In-Memory for Rate Limiting:** Single-instance deployments do not need distributed rate limiting. The existing memory fallback is sufficient.
3. **Defer Managed Redis:** Do not move to Upstash or DO Managed Redis until tenant load justifies the cost and complexity (~100-150 tenants).
4. **Monitor Memory:** Use `maxmemory` limits to protect the droplet from Redis RAM growth.

## Strategic Note
"Redis scaling and managed Redis migration are intentionally DEFERRED until ReplyBase reaches meaningful production load (~100+ active concurrent tenants)."

This ensures that development focus remains on product-market fit rather than premature infrastructure scaling.
