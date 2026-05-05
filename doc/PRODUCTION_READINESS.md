# Production Readiness & Scaling Guide: ReplyBase SaaS

This document outlines the core services, configuration, and scaling roadmap required to run ReplyBase smoothly in production.

## 1. Service Infrastructure & Scaling Roadmap

| Service Name | 100 Subscribers | 1k Subscribers | 10k Subscribers | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **App Hosting** | Single Container (2 vCPU, 4GB RAM) | 3+ Replicas (Auto-scaling) | HA Cluster / Kubernetes | Use `standalone` Docker output. |
| **PostgreSQL** | Managed (1 vCPU, 2GB RAM) | Managed (4 vCPU, 16GB RAM) | HA Cluster + Read Replicas | Requires PG 13+ (Prisma 7.8.0). |
| **Redis (Cache/Jobs)** | Shared/Small (512MB) | Dedicated (2GB+) | Redis Cluster (Primary+Replica) | Required for BullMQ & Cache. |
| **AI Providers** | Pay-as-you-go | Tier 2/3 Limits (Auto-topup) | Enterprise / Provisioned Throughput | High rate-limits needed for webhooks. |
| **Background Workers** | Integrated in App | Separate Worker Container | Dedicated Worker Cluster | Separate compute to scale message processing. |
| **Stripe (Billing)** | Standard | Standard + Webhook Signing | Enterprise + Reconciliation Jobs | Vital for revenue integrity. |
| **Email (Resend)** | Pro Tier | Business Tier | Enterprise / Dedicated IPs | Used for leads & trial reminders. |
| **CDN & WAF** | Cloudflare (Free) | Cloudflare (Pro) | Cloudflare (Business/Enterprise) | WAF is critical for Webchat protection. |
| **Observability** | Pino + Console | Sentry + BetterStack | Datadog / New Relic | Critical for debugging BullMQ jobs. |

### Technical Scaling Notes
- **Rate Limiting:** At 10k subscribers, move rate limiting to the WAF/Edge (e.g., Cloudflare) to protect Redis/DB from exhaustion.
- **Worker Concurrency:** Currently set to `5` in `lib/queue.ts`. Increase this value as you scale the background worker replicas.
- **Database Pooling:** Use a pooler like **PgBouncer** to manage high connection counts from serverless/container restarts.

---

## 2. Service Configuration & Installation Instructions

### A. Next.js Application (Standalone)
The application is optimized for containerization via the root `Dockerfile`.
- **Build**: `docker build -t replybase-app .`
- **Run**: `docker run -p 3000:3000 --env-file .env replybase-app`
- **Build Args**: Ensure `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are provided during build.

### B. PostgreSQL (Database)
- **Setup**: Use a managed service like AWS RDS, Supabase, or Neon.
- **Initialization**:
  1. `pnpm prisma db push --accept-data-loss` (initial schema sync).
  2. `pnpm run seed:stripe` (syncs plan metadata to your DB).
- **Maintenance**: Ensure `DATABASE_URL` uses a pooling connection string in production.

### C. Redis (Cache & BullMQ)
- **Requirement**: Redis 6.2+ is mandatory for BullMQ support.
- **Configuration**: Set `maxmemory-policy: allkeys-lru` for caching nodes.
- **Isolation**: For >1k subscribers, use a dedicated Redis instance for BullMQ to prevent cache eviction from affecting background jobs.

### D. BullMQ Background Workers
- **Configuration**: Workers are initialized via `instrumentation.ts`.
- **Scaling Strategy**:
  - **API Nodes**: Set `NEXT_PHASE=phase-production-build` to disable workers on API-only containers.
  - **Worker Nodes**: Run dedicated containers with `pnpm start` to process queues without serving HTTP traffic.

### E. External Integration (Stripe & Meta)
- **Stripe**: Configure Webhook URL to `https://<your-domain>/api/billing/webhook`.
- **Meta (WhatsApp/Facebook)**:
  - Configure Webhook URL to `https://<your-domain>/api/whatsapp/webhook`.
  - Ensure `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches your Meta App Dashboard settings.

### F. Monitoring & Logging
- **Logging**: The app uses `pino`. Pipe stdout to a log aggregator (e.g., `node server.js | pino-axiom`).
- **Health Checks**: Orchestrators (Coolify/K8s) should monitor the `:3000/api/health` endpoint for liveness probes.

### G. Security
- **Webchat CORS**: Strictly define `WEBCHAT_ALLOWED_ORIGINS` in `.env` to prevent unauthorized widget embedding.
- **Secrets**: Periodically rotate `AUTH_SECRET` and `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` (AES-256-GCM).
