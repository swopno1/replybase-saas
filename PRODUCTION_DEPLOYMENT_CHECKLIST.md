## Project Summary

ReplyBase (ReplyBase SaaS) is a Next.js 16-based multitenant SaaS for conversational bot management and channels (Meta, WhatsApp, Telegram, Webchat). Core pieces observed in the repo:

- Web app: Next.js App Router (`app/`)
- Database: PostgreSQL with Prisma ORM
- Background processing: BullMQ (Redis)
- Auth: NextAuth
- Monitoring: Sentry
- Payments: Stripe
- Email: Resend
- AI providers: OpenAI / Anthropic / Google / DigitalOcean AI

Primary concerns before production:

- Next.js version is outdated and flagged in system inspection; upgrade urgently.
- Secrets and sensitive API keys must be stored in a secrets manager (do not keep in repo or plaintext .env files).
- Implement DB Row Level Security (RLS) and tenant-aware middleware.
- Harden webhooks and external integrations with strict timeouts, retries and idempotency.

## Production Deployment Checklist

1. Infrastructure & Services

- PostgreSQL (managed): single primary + automated daily backups and PITR. Use read replicas if needed.
- Redis (managed, e.g., Upstash / ElastiCache): used by BullMQ for workers and caching.
- Object storage (S3 / DigitalOcean Spaces) if app stores attachments/media.
- Secrets manager (AWS Secrets Manager / HashiCorp Vault / GitHub Secrets) for all production secrets.
- Domain + TLS (Cloudflare/ACM + CDN) for app and assets.
- Worker hosts / horizontal autoscaling for BullMQ workers.
- Monitoring & logging: Sentry, pino central logging (forward logs to ELK/Datadog), metrics (Prometheus/Grafana).
- Queueing & retry: BullMQ with visibility into failed jobs and DLQ.
- Email provider: Resend (production key) or fallback provider.
- Stripe account + webhooks endpoint (secure, verify signatures).

2. Required Environment Variables (ensure values in production secrets manager)

- NODE_ENV=production
- DATABASE_URL (postgres, with SSL where required)
- SHADOW_DATABASE_URL (for migrations, as needed)
- REDIS_URL
- NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_BASE_URL
- NEXTAUTH_URL and AUTH_SECRET
- CHANNEL_CREDENTIALS_ENCRYPTION_KEY
- API_SECRET_KEY and CRON_SECRET
- OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, DIGITALOCEAN_AI_KEY (as used)
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- NEXT*PUBLIC_STRIPE*\*\_PRICE_ID values
- OAUTH: GOOGLE_CLIENT_ID/SECRET, FACEBOOK_CLIENT_ID/SECRET, WHATSAPP_APP_SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN
- RESEND_API_KEY (email)
- SENTRY DSN (NEXT_PUBLIC_SENTRY_DSN and server-side DSN as needed)

3. Pre-deploy Tests & Validation

- Run unit tests: `npm run test` (or `pnpm` equivalent).
- Run e2e tests: `npm run test:e2e` (Playwright). Use a staging domain that mirrors production.
- Linting: `npm run lint`.
- Build: `npm run build` (ensure `prisma generate` runs and build succeeds).
- Smoke test API endpoints (health, webhooks, billing webhook) on staging.
- Run load test on critical flows (webhook endpoints and message ingestion) and verify DB connection pool sizing.
- Verify worker processing on staging: enqueue jobs and confirm success/retries.

4. Database & Migrations

- Use managed Postgres with automated backups and point-in-time restore.
- Apply Prisma migrations from CI/CD; run `prisma migrate deploy` in deployment pipeline.
- Seed required production-only data carefully (pricing IDs, admin account provisioning).
- Implement PostgreSQL Row Level Security (RLS) policies to enforce tenant isolation.
- Configure connection pooling (PgBouncer) if needed; tune max connections to match instance.

5. Security & Hardening

- Upgrade Next.js to a maintained, secure release and audit transitive dependencies.
- Enforce HTTPS and HSTS.
- Use CSP, input sanitization, and remove or scope `dangerouslySetInnerHTML` usages.
- Token rotation and secrets lifecycle policies in secrets manager.
- Webhook endpoints: verify provider signatures (Stripe, Facebook, WhatsApp), idempotency keys, and rate-limits.
- Implement rate limiting (API gateway / middleware) on public endpoints.
- Limit CORS to expected origins.

6. Observability & Alerts

- Sentry: configure environments, releases, and sampling for traces.
- Metrics: track request latency, error rates, worker queue size, and job failure rates.
- Alerts: page/Slack on Sentry critical errors, high queue failures, DB down, or backup failures.

7. Operational Runbook (staging → production)

- Validate secrets and env var values copied to production secrets store.
- Deploy to staging; run full test suite and smoke tests.
- Run migrations on a read-only maintenance window if schema-changing operations expect downtime.
- Deploy web frontend + API; verify health endpoints; enable workers after web deployment.
- Enable backups and monitor for first 24–72 hours.

8. Post-deploy Checks

- Verify billing webhooks processing and subscription gating.
- Validate messaging integrations (Facebook, WhatsApp, Telegram) on production credentials.
- Confirm email delivery via Resend.
- Run end-to-end flows: send / receive messages, flows execution, lead creation.

9. Rollback Plan

- For DB migration issues, keep a tested backup and steps to restore to pre-deployment snapshot.
- For app-level failures, revert to previous container image and scale down new instances.

## Cleanup Actions Performed

- Removed legacy/stale component listing files to reduce repo noise (component lists and lib manifests).

## Next Steps

- Review and secure all production secrets into a secrets manager.
- Upgrade Next.js and re-run the audit from `SYSTEM_INSPECTION_REPORT.md`.
- Implement RLS and add `middleware.ts` to centralize authentication and tenant enforcement.
