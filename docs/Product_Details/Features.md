# Features and Capabilities: ReplyBase

> Last updated: June 2026. Reflects confirmed production state.

---

## 1. Live Channels

All five channels are fully live and production-gated by plan tier:

| Channel | Plan Availability |
|---|---|
| Webchat (embeddable widget) | All plans (Free and above) |
| Facebook Messenger | Launch, Grow, Scale, Business |
| WhatsApp Cloud API | Grow, Scale, Business |
| Telegram Bot | Scale, Business |
| Website Forms (lead capture) | All plans |

Channel gating is enforced at bot creation and enforced in subscription middleware. Downgrade handling disables out-of-plan bots automatically.

---

## 2. Flow Builder & Automation

- **7 node types:** `message`, `input`, `condition`, `action`, `wait`, `typing`, `end`
- **8 action types:** `tag_user`, `update_status`, `call_flow`, `end_flow`, `schedule`, `checkout`, `booking`, `trigger_webhook`
- **Sub-flows:** flows can call other flows via `call_flow` action
- **30+ industry templates** (e-commerce, restaurants, real estate, SaaS, legal, etc.)
- **Live simulation lab** in admin panel for testing flows without deploying
- Response mode per bot: Flow only · AI only · Flow → AI fallback · AI → Flow fallback

---

## 3. AI Engine

- **AI fallback:** When a message doesn't match a flow, AI responds using a business-context system prompt generated during onboarding
- **Guardrails:** Injection protection, topic restriction, competitor mention filtering
- **Cross-channel context:** AI carries conversation history across channels when contact identity is stitched
- **AI onboarding:** Structured business summarization (`generateObject`) → auto-generates bot system prompt
- **Multi-provider routing:**
  - DigitalOcean AI is the platform default for all system tasks
  - Tenants can configure their own provider/API key/model for full override
  - Google embeddings used for semantic search and lead enrichment
- **Model tier selection by task:** utility tasks (intent, tagging) use lightweight models; onboarding and Pro+ chat use premium models

---

## 4. CRM & Lead Management

- **Unified inbox** across all connected channels per tenant
- **Contact identity stitching:** messages from the same user across channels are linked to one contact record
- **Lead status pipeline:** new → qualified → contacted → closed/lost
- **Tagging:** manual and AI-suggested tags on lead records
- **Lead enrichment:** AI scoring for urgency, category, and inferred needs
- **Instant notifications:** new leads pushed via Telegram bot or email (configurable)

---

## 5. Plan Tiers

| Plan | Price | Channels | Notable Limits |
|---|---|---|---|
| Free | £0 | Webchat only | 1 bot, 100 conversations/mo |
| Launch | £29/mo | Webchat + Facebook OR WhatsApp | 3 bots |
| Grow | £49/mo | Webchat + Facebook + WhatsApp | 10 bots |
| Scale | £89/mo | All above + Telegram | Unlimited bots, outgoing webhooks |
| Business | £249/mo | All channels | API key access, white-label branding, SLA |

Annual billing available at ~20% discount. **FOUNDING50** promo: 50% off annual plans for first 20 customers (12-month duration).

---

## 6. Admin Panel

- Subscriber management with Stripe sync and audit trail
- AI onboarding editor (business details, industry, sub-industry, AI context preview)
- Simulation lab for per-tenant flow and AI testing
- Sentry observability: every AI call tagged with provider, model, task, and tenant

---

## 7. Security & Compliance

- `withAuthAndTenant` middleware enforcing tenant isolation on all routes
- Webhook signature verification for all inbound channels
- GDPR-aligned data deletion and export workflows
- Sentry PII hardening (in progress — Task 046)

---

## 8. Infrastructure

- Next.js 14 App Router, Prisma + PostgreSQL, Redis
- BullMQ background workers for message processing and webhook dispatch
- Deep health checks at `/api/health` (Prisma + Redis pings)
- Rate limiting via Redis (falls back to in-memory)

---

## 9. Coming Soon (Business Tier — Q3 2026)

- **API Key Access** (Task 057): REST API with Bearer token auth, scoped keys, rate limits
- **Outgoing Webhooks** (Task 058): Push live events to external systems with HMAC signing and retry logic
- **White-Label Branding** (Task 059): Custom logo, colors, and email sender identity on webchat and notifications
- **SLA Support Tiers** (Task 060): Defined response SLAs per plan, priority support routing for Business subscribers

See full task list in [../TASKS.md](../TASKS.md).
