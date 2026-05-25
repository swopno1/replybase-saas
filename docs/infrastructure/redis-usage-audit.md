# Redis Usage Audit - ReplyBase

## Overview
This document provides a complete audit of Redis usage across the ReplyBase codebase as of August 2026.

## 1. Queue Systems (BullMQ)
The primary use of Redis in ReplyBase is for background job processing via BullMQ.

### message-processing
- **Source:** `lib/queue.ts`
- **Purpose:** Handles inbound messages from social channels (WhatsApp, Facebook, Telegram).
- **Why it exists:** Social platforms (especially Meta) require a 200 OK response within a few seconds (usually < 5s, but 200ms is best practice). AI processing and Flow execution can take much longer.
- **Criticality:** **CRITICAL**. Without this, webhooks would time out, causing retries and duplicate processing.

### webhook-delivery
- **Source:** `lib/services/webhook-dispatcher.ts`
- **Purpose:** Dispatches outbound webhooks to tenant-configured endpoints.
- **Why it exists:** Ensures reliable delivery with retries and prevents outbound network latency from blocking application threads.
- **Criticality:** **IMPORTANT**. Could theoretically be handled by a simpler in-memory queue or deferred DB-based queue at low scale, but BullMQ provides robust retry logic.

## 2. Caching
### Tenant Subscription Limits
- **Source:** `lib/subscription.ts`
- **Key Pattern:** `limits:{tenantId}`
- **TTL:** 1 hour (3600s)
- **Purpose:** Prevents redundant database queries to the `Subscription` and `Plan` tables on every message ingestion and flow execution.
- **Criticality:** **IMPORTANT**. Removal would increase RDS/Postgres load but wouldn't break functionality.

## 3. Rate Limiting
### Generic API Limiter
- **Source:** `lib/rate-limit.ts`
- **Implementation:** Hybrid (Upstash REST -> In-memory).
- **Criticality:** **OPTIONAL**. Primarily relies on in-memory `Map` when self-hosted Redis is not configured via `UPSTASH_REDIS_REST_URL`.

### Webchat Limiter
- **Source:** `lib/webchat-rate-limit.ts`
- **Implementation:** Hybrid (Upstash REST -> In-memory).
- **Criticality:** **OPTIONAL**. Similar to the generic limiter, it falls back to a local `Map`.

## 4. Systems NOT Using Redis
- **Sessions:** NextAuth uses JWT strategy (`strategy: "jwt"`). Sessions are stored in browser cookies, not Redis.
- **Websockets:** The CRM currently uses 5s polling (`app/(dashboard)/conversations/[conversationId]/page.tsx`), so no Redis Pub/Sub is required for realtime state sync yet.
- **AI Buffering:** AI responses are streamed or returned directly to the worker; no intermediate Redis buffering was found.
- **Distributed Locks:** No explicit use of Redlock or similar distributed locking mechanisms found.

## 5. Summary Table

| Feature | Criticality | Alternative | Impact of Removal |
|---------|-------------|-------------|-------------------|
| Message Queue | **CRITICAL** | DB-based Queue | High (Webhook timeouts) |
| Webhook Queue | **IMPORTANT** | DB-based Queue | Medium (Outbound reliability) |
| Subscription Cache | **IMPORTANT** | In-memory Map | Low (Higher DB load) |
| Rate Limiting | **OPTIONAL** | In-memory Map | None (Already supported) |
