# System Architecture Report - ReplyBase SaaS

## Overview
ReplyBase is a multi-tenant SaaS platform built on Next.js 16 (App Router) with a unified messaging architecture. The system centralizes communication from Webchat, Telegram, and WhatsApp into a single dashboard.

## Core Components

### 1. Multi-Tenant Data Layer
- **ORM**: Prisma 7.8.0.
- **Isolation**: Automatic tenant isolation via Prisma Extensions (`getTenantPrisma`).
- **Enforcement**: Middleware-level (`withAuthAndTenant`) and API-level scoped lookups.
- **Risk**: Some legacy routes still use global Prisma client lookups, though they are manually scoped by `tenantId`.

### 2. Message Processing Engine (BullMQ)
- **Queue System**: Redis-backed BullMQ for asynchronous processing.
- **Workers**:
  - `message-processing`: Handles inbound webhooks (FB, Telegram, WhatsApp) and AI enrichment.
  - `outbound-webhooks`: Manages delivery of lead data to external client URLs.
- **Scalability**: High concurrency support (5-10 per worker) with exponential backoff retries.

### 3. AI Service Layer
- **Provider**: Vercel AI SDK (OpenAI, Anthropic, Google Gemini).
- **Fallback Logic**: Tiered AI responses based on subscription plan.
- **Onboarding**: AI-driven customization of conversational flows during signup.

### 4. Integration Hub
- **Facebook/WhatsApp**: Webhook handlers with signature verification.
- **Telegram**: Bot API with secret-token validation.
- **Webchat**: Custom widget with CORS and rate-limiting protection.

## Architectural Health
- **Modularity**: 9/10 (Service layer separation is improving).
- **Security**: 8.5/10 (Strong tenant isolation).
- **Resilience**: 9/10 (Queue-based async processing).
- **Scalability**: 8/10 (Usage buffering and Redis/BullMQ are production-ready).
