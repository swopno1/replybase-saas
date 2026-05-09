# System Architecture Report - ReplyBase SaaS (Updated July 2026)

## Overview
ReplyBase is a production-hardened multi-tenant SaaS platform built on Next.js 16 (App Router) with a resilient multi-bot/multi-channel messaging architecture.

## Core Components

### 1. Multi-Tenant Data Layer
- **ORM**: Prisma 7.8.0.
- **Isolation Strategy**: Automatic tenant isolation via Prisma Query Extensions (`getTenantPrisma`). This layer intercepts all queries and injects `tenantId`, preventing accidental cross-tenant data leakage.
- **Strict Enforcement**: The `withAuthAndTenant` higher-order function ensures all API handlers operate within a scoped context.

### 2. Multi-Bot Architecture
- **Structure**: Each Tenant can have multiple Bots. Each Bot manages its own set of Channels (Webchat, Facebook, Telegram, WhatsApp).
- **Routing**: Webhooks are routed deterministically based on provider-specific IDs (e.g., Facebook Page ID, WhatsApp Phone Number ID) to the specific Bot context.

### 3. Distributed Task Processing (BullMQ)
- **Engine**: Redis-backed BullMQ manages long-running and high-frequency tasks.
- **Dedicated Workers**:
  - `message-processing`: Inbound message routing, AI response generation, and flow execution.
  - `outbound-webhooks`: Reliable delivery of lead events to external CRMs/webhooks with retry logic.
  - `lead-enrichment`: Background AI analysis of lead intent and quality.

### 4. AI & Automation Layer
- **AI Engine**: Grounded AI Fallback system using Vercel AI SDK. Context is injected from bot-specific settings to ensure high-quality, brand-aware responses.
- **Flow Engine**: A visual builder that executes logic-based nodes (Messages, Inputs, Actions, Conditions).

## Architectural Health Assessment
- **Modularity**: 9/10. Logic is well-separated into Services (`lib/services`) and Workers.
- **Security**: 9/10. Tenant isolation is robust, with minor gaps being addressed (WebhookLog tenancy).
- **Reliability**: 9.5/10. Use of BullMQ and Idempotency keys prevents data loss and duplicate processing.
- **Scalability**: 8.5/10. Usage buffering and tiered AI failover provide a strong foundation for high traffic.

## Future Evolution
- **IAM**: Transition from flat Roles to granular Permissions for enterprise teams.
- **Data Locality**: Potential for region-specific database clusters for global compliance.
- **Edge Runtime**: Move Webchat handshake and routing to the Edge to minimize latency.
