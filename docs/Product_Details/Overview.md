# Product Overview: ReplyBase

> Last updated: June 2026. Reflects confirmed production state.

---

## Product Positioning

ReplyBase is a **multi-channel chatbot automation platform** for small and mid-size businesses.

It lets teams:
- Connect customer messaging across 5 channels in one workspace
- Build automated bot flows without writing code
- Capture and qualify leads from every conversation
- Use AI fallback to handle messages that flows don't cover

---

## Vision and Mission

- **Vision:** become the go-to automation-first inbox for SME customer communication
- **Mission:** make multi-channel chatbot deployment practical and affordable for non-technical teams — without enterprise pricing or complexity

---

## Live Channels (All Five Active)

| Channel | Status |
|---|---|
| Webchat (embeddable widget) | Live |
| Facebook Messenger | Live |
| WhatsApp Cloud API | Live |
| Telegram Bot | Live |
| Website Forms | Live |

Channel access is plan-gated. Free subscribers get Webchat only. Business subscribers get all five.

---

## Canonical Product Model

1. **Workspace (Tenant):** isolated business account boundary
2. **Bot:** automation container, scoped to one or more channels, owns flow and AI settings
3. **Flow:** drag-and-drop conversation tree (7 node types, 8 action types)
4. **AI Fallback:** auto-response engine using business context when no flow node matches
5. **Lead Record:** structured contact + conversation outcome, enriched by AI scoring
6. **Unified Inbox:** all channel conversations surfaced in one CRM-style view

---

## Core Problems We Solve

1. Customer messages arriving on multiple channels with no unified handling
2. Teams spending time on repetitive, low-complexity conversations
3. Leads captured in chat then lost because there's no structured handoff
4. AI tools too generic — no business context in the system prompt

---

## Plan Structure

| Plan | Price | Channels | Key Unlock |
|---|---|---|---|
| Free | £0 | Webchat | Get started |
| Launch | £29/mo | + Facebook or WhatsApp | First paid automation |
| Grow | £49/mo | + Facebook and WhatsApp | Full omnichannel core |
| Scale | £89/mo | + Telegram + Webhooks | Integration-ready |
| Business | £249/mo | All + API + White-Label + SLA | Enterprise buyers, agencies |

Annual billing available. FOUNDING50 promo (50% off annual, first 20 customers) is live.

---

## Strategic Direction — 2026

Current focus is expanding the Business tier with developer-facing features and enterprise trust signals:

- **API Key Access** — REST API for integration-heavy SMBs and agencies (Q3 2026)
- **Outgoing Webhooks** — push live events to Zapier, Make, custom CRMs (Q3 2026)
- **White-Label Branding** — agencies and resellers present under their own brand (Q3 2026)
- **SLA Support Tiers** — defined response commitments per plan, priority routing for Business (Q3 2026)

Secondary focus: security hardening (auth scoping, Sentry PII), and observability (distributed tracing across BullMQ workers).

---

## Runtime Promise

For every bot connected to a channel, operators see:
- what mode it's running (Flow / AI / Flow→AI fallback / AI→Flow fallback)
- which flow last ran and what it resolved to
- where the result landed in the lead and conversation record

---

## Document Map

- Feature details and plan comparison: [Features.md](Features.md)
- Technical system and data model: [Architecture_and_DB.md](Architecture_and_DB.md)
- UI and navigation strategy: [UI_UX_Strategy.md](UI_UX_Strategy.md)
- GTM and commercial strategy: [Business_and_Marketing.md](Business_and_Marketing.md)
- Task list and priorities: [../TASKS.md](../TASKS.md)
