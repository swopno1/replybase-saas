# Redis Usage Audit - ReplyBase

## Overview
This document provides a complete audit of Redis usage across the ReplyBase codebase as of August 2026. It evaluates the necessity of each dependency for the current startup phase.

## Redis Workload Audit

### 1. BullMQ: Message Processing Queue (`message-processing`)
- **Location:** `lib/queue.ts`
- **Usage:** Enqueues incoming messages from Facebook, WhatsApp, and Telegram. Also handles lead enrichment and Stripe jobs.
- **Why it's used:** Offloads heavy processing (AI intent extraction, Flow Engine execution) from the webhook request-response cycle. Meta and Telegram require webhooks to respond within seconds.
- **Classification:** **CRITICAL**
- **Justification:** Essential for reliability. Without background processing, high-latency AI calls would cause webhook timeouts and duplicate message deliveries from providers.

### 2. BullMQ: Outbound Webhooks Queue (`outbound-webhooks`)
- **Location:** `lib/services/webhook-dispatcher.ts`
- **Usage:** Manages delivery of webhooks to external URLs configured by tenants (e.g., `lead.created`).
- **Why it's used:** Ensures webhook delivery doesn't block the core messaging flow and provides built-in retry logic.
- **Classification:** **IMPORTANT**
- **Justification:** While critical for a mature SaaS, at a very small scale, this could be handled by simple `setTimeout` or background promises, but BullMQ provides necessary reliability and observability.

### 3. Subscription Limit Caching
- **Location:** `lib/subscription.ts`
- **Usage:** Caches tenant subscription limits (L2 cache) for 1 hour.
- **Why it's used:** Reduces database load for frequent limit checks.
- **Classification:** **OPTIONAL**
- **Justification:** Database queries for subscription status are fast enough at the current scale. This is a classic "optimization" that is not strictly required yet.

### 4. Webchat Rate Limiting
- **Location:** `lib/webchat-rate-limit.ts`
- **Usage:** Limits requests to webchat endpoints to prevent abuse.
- **Why it's used:** Distributed rate limiting.
- **Classification:** **OPTIONAL**
- **Justification:** The system already includes a robust in-memory fallback. Redis (via Upstash REST) is only used if configured.

### 5. Health Checks
- **Location:** `app/api/health/route.ts`
- **Usage:** Pings Redis to ensure connectivity.
- **Classification:** **MISSION-CRITICAL (for observability)**
- **Justification:** Necessary to monitor the health of background job processing.

## Summary of Redis Usage

| Feature | Dependency | Classification | Alternative |
|---------|------------|-------------|-------------|
| Messaging Queue | BullMQ | **CRITICAL** | None (Reliable async processing needed) |
| Webhook Retries | BullMQ | **IMPORTANT** | Simple background promises (less reliable) |
| Limit Caching | ioredis | **OPTIONAL** | Direct Database Queries |
| Rate Limiting | Upstash/REST | **OPTIONAL** | In-memory store (already exists) |
| Session Store | NextAuth/JWT | **NONE** | Using JWT strategy (no Redis needed) |
| Realtime Sync | Polling | **NONE** | Currently using 5s polling, no Pub/Sub |

## Assessment
Redis is primarily used as a **Job Queue backend (BullMQ)**. This is its most critical function in ReplyBase. The caching and rate-limiting aspects are secondary and can be handled by other means or deferred.

The RAM pressure concerns are valid for a 500MB/1GB droplet, but the architectural need for a reliable queue for social messaging (FB/WA) justifies its presence.
