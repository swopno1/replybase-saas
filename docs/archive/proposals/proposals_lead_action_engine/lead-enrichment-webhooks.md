# Proposal: Lead Connect & Action Engine

## 1. Technical Objectives
- Enable real-time lead data synchronization with external platforms (Zapier, HubSpot, etc.).
- Enhance lead quality with automated AI-driven structured insights.
- Provide flexible "Action" nodes in the flow builder for event-driven automation.

---

## 2. Data Model Changes (Prisma) ✅

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
```prisma
model Lead {
  // ... existing fields
  insights  Json?  // { score: number, urgency: string, needs: string[], summary: string, category: string }
}
```

---

## 3. Core Components ✅

### A. Webhook Dispatcher (`lib/services/webhook-dispatcher.ts`)
A background service (using BullMQ) to handle outbound POST requests with:
- **Retries**: Exponential backoff for failed deliveries.
- **Security**: HMAC-SHA256 signature in `X-ReplyBase-Signature`.
- **Payload**: Standardized JSON including lead details, contact info, and AI insights.

### B. AI Enrichment Worker (`lib/services/lead-enrichment.ts`)
When a lead is captured, a background job in `lib/queue.ts` is triggered to:
1. Fetch the raw enquiry and conversation context.
2. Call the AI model (getAiModel) with a structured extraction prompt.
3. Update the Lead's `insights` field in the database.
4. Trigger the `lead.created` webhook (enriched with the new insights).

### C. Flow Action: "Trigger Webhook"
New action type in `lib/flow-execution-engine.ts`:
- **Node Content**: `{ action: "trigger_webhook" }`.
- **Logic**: Dispatcher finds active subscriptions for `flow.action` and POSTs the current context.

---

## 4. Implementation Status ✅
- **Phase 1 (Outbound Webhooks)**: COMPLETE.
- **Phase 2 (AI Enrichment)**: COMPLETE.
- **Phase 3 (Action Node)**: COMPLETE.
- **Reliability Layer**: COMPLETE (BullMQ integration).

## 5. Success Metrics
- **Activation**: % of Pro/Business users who connect at least one webhook.
- **Quality**: User feedback on AI lead score accuracy.
- **Latency**: Time from lead capture to CRM arrival (Target: < 10 seconds).
