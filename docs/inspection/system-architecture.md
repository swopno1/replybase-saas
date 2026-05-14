# System Architecture & Logic Master Audit - ReplyBase SaaS (Updated August 2026)

## 1. Core Architectural Pillars
- **Multi-Tenant Isolation**: Automated at the database layer via Prisma Client Extensions (`getTenantPrisma`). DMMF introspection automatically identifies and scopes all models with a `tenantId` field.
- **Asynchronous Execution**: Heavy workloads (AI generation, lead enrichment, outbound webhooks) are offloaded to a tiered BullMQ architecture to ensure fast API responses and system resilience.
- **Provider Abstraction**: Pluggable architecture for Messaging Channels (Meta, Telegram, WhatsApp, Webchat) and AI Engines (Llama 3.1 via DO Gradient, Gemini, OpenAI).
- **Service-Oriented Logic**: Business rules are encapsulated in standalone services (e.g., `LeadEnrichmentService`, `BillingService`, `WebhookDispatcher`).

## 2. End-to-End Message Lifecycle (High-Level)

### Inbound Flow
1. **Ingress**: Webhook arrives from provider (e.g., Meta) or client (Webchat).
2. **Identification**: `proxy.ts` or route handler identifies the tenant, bot, and channel credentials.
3. **Persistence**: Message is logged in `CrmMessage` for audit and CRM visibility.
4. **Processing (Async)**:
   - **Flow Engine**: Attempts to execute matching nodes in the bot's configured JSON flow.
   - **AI Fallback**: If no flow handles the message, `aiFallback` generates a response using the bot's stored context and conversation history.
5. **Egress**: Response is delivered back through the originating provider's API.

### Lead & Action Flow
1. **Capture**: `LeadService` identifies lead signals during conversation.
2. **Enrichment (Async)**: AI extracts structured insights (score, urgency, category, needs) into the `Lead.insights` field.
3. **Action (Async)**: If a `trigger_webhook` action is reached, the `WebhookDispatcher` pushes the lead data to the user's external CRM/URL with exponential backoff retries.

## 3. Implemented Feature Landscape

### Communication & Automation
- **Unified Inbox**: Multi-channel CRM dashboard with real-time streaming updates.
- **V6 Orchestrator**: Advanced node-based flow engine supporting complex logic, conditions, and actions.
- **AI-Powered Fallback**: Context-aware automated responses for unhandled queries.
- **Lead Connect & Action Engine**: Real-time outbound lead synchronization via reliable webhooks.

### Operations & Growth
- **Activation Milestones**: Retention-focused onboarding tracking.
- **Advanced Admin Suite**: KPI dashboards, acquisition analysis, and a "Simulation Lab" for testing flows.
- **Subscription Management**: Tiered pricing with strict quota enforcement (Messages, Bots, Channels).

## 4. Architectural Health & Risks

### Health Ratings
- **Modularity**: 9.5/10. Strong separation of concerns.
- **Security**: 9.5/10. Automated isolation and hardened Admin surface.
- **Reliability**: 9.5/10. Idempotent processing and queue-backed resilience.

### Remaining Risks & Drifts
- **Distributed Idempotency (REMEDIATED)**: Moved from in-memory locks to DB-level `IdempotencyKey` tracking.
- **Waterfall Latency (MEDIUM)**: Sequential (Check Flow) -> (Check AI) processing. **Path**: Explore parallel execution or Edge-based routing for initial handshakes.
- **Lead Data Siloing (REMEDIATED)**: Closed via the Lead Action Engine (Task 005).

## 5. Evolution Roadmap
- **IAM (Phase 4)**: Transition to granular permissions for enterprise support teams.
- **Mobile Bot Management**: Lightweight "Flow Summary" views for on-the-go adjustments.
- **Regional Compliance**: Potential for data locality clustering as the platform scales globally.
