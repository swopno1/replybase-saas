# Proposal: Lead Connect & Action Engine

## 1. Technical Objectives
- Enable real-time lead data synchronization with external platforms.
- Enhance lead quality with automated AI-driven structured insights.
- Provide flexible "Action" nodes in the flow builder for event-driven automation.

---

## 2. Data Model Changes (Prisma)

### New Model: `WebhookSubscription`
```prisma
model WebhookSubscription {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  url         String
  eventTypes  Json     // ["lead.created", "lead.updated", "flow.action"]
  secret      String?  // For HMAC signing
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("webhook_subscriptions")
}
```

### Schema Enhancement: `Lead`
Add a new `insights` field to store AI-extracted data.
```prisma
model Lead {
  // ... existing fields
  insights  Json?  // { score: number, urgency: string, needs: string[], ... }
}
```

---

## 3. Core Components

### A. Webhook Dispatcher (`lib/services/webhook-dispatcher.ts`)
A background service (using BullMQ) to handle outbound POST requests with:
- **Retries**: Exponential backoff for failed deliveries.
- **Security**: Optional HMAC-SHA256 signature in `X-ReplyBase-Signature`.
- **Payload**: Standardized JSON including lead details, contact info, and AI insights.

### B. AI Enrichment Worker (`lib/services/lead-enrichment.ts`)
When a lead is captured, a background job is triggered to:
1. Fetch the raw enquiry and conversation context.
2. Call the AI model (e.g., Gemini 1.5 Pro) with a structured extraction prompt.
3. Update the Lead's `insights` field in the database.
4. Trigger the `lead.created` webhook (enriched with the new insights).

### C. Flow Action: "Trigger Webhook"
Add a new action type to `lib/flow-execution-engine.ts`:
- **Node Content**: `{ action: "trigger_webhook", webhookId: "...", payload: { ... } }`.
- **Use Case**: Fire a specific webhook only when a user selects a particular path (e.g., "Request a Quote").

---

## 4. Logic Flow: Lead Capture to CRM

1. **Capture**: `app/api/public/leads/route.ts` creates a Lead record.
2. **Enrich (Async)**: `lead-enrichment-worker` processes the enquiry.
3. **Notify (Sync)**: Existing Email/Telegram alerts are sent.
4. **Sync (Async)**: `webhook-dispatcher` finds active subscriptions for `lead.created` and POSTs the enriched JSON to the client's CRM/Zapier endpoint.

---

## 5. Implementation Phases

### Phase 1: Outbound Webhooks (The "Connect" Part)
- Add `WebhookSubscription` model.
- Implement `webhook-dispatcher` using BullMQ.
- Add UI to Dashboard: `Settings > Integrations > Webhooks`.

### Phase 2: AI Enrichment (The "Intelligence" Part)
- Add `insights` field to Lead model.
- Implement `lead-enrichment-worker`.
- Update Lead Detail UI to display score and insights.

### Phase 3: Action Node (The "Action" Part)
- Update `FlowExecutionEngine` to support `trigger_webhook`.
- Update visual builder (when available) or JSON templates to allow webhook selection.

---

## 6. Success Metrics
- **Activation**: % of Pro/Business users who connect at least one webhook.
- **Quality**: User feedback on AI lead score accuracy.
- **Latency**: Time from lead capture to CRM arrival (Target: < 30 seconds).
