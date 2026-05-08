# Implementation Details: Lead Connect & Action Engine

## Overview
The Lead Connect & Action Engine has been fully implemented to bridge the gap between ReplyBase's lead capture and external CRMs/Automation tools.

## Core Components

### 1. Reliable Background Processing
- **Queue System**: Integrated with `BullMQ` to ensure that every captured lead is processed for enrichment and pushed to external webhooks, even if the primary API request completes or the server restarts.
- **Workers**:
    - `Message Worker`: Extended to handle `lead_enrichment` tasks.
    - `Webhook Worker`: A dedicated worker for outbound POST requests with exponential backoff and retry logic.

### 2. AI Lead Enrichment
- **Service**: `lib/services/lead-enrichment.ts`
- **Logic**: Uses the Vercel AI SDK to analyze raw inquiries and extract:
    - **Lead Score**: (1-10) based on intent.
    - **Urgency**: Low, Medium, High.
    - **Category**: Sales, Support, etc.
    - **Needs**: List of specific requirements.
    - **Summary**: Concise inquiry overview.

### 3. Outbound Webhooks
- **Model**: `WebhookSubscription` (Prisma)
- **Security**: Optional HMAC-SHA256 signatures included in the `X-ReplyBase-Signature` header for payload verification.
- **Events**:
    - `lead.created`: Triggered after enrichment.
    - `flow.action`: Triggered via the Flow Engine.

### 4. Flow Engine Integration
- **Action**: `trigger_webhook`
- **Usage**: Allows business owners to fire specific webhooks when a user reaches a certain point in a conversation (e.g., "Request a Quote").

## API Endpoints
- **Public Lead Capture**: `POST /api/public/leads` (Now queues enrichment/webhooks).
- **Webhook Management**: `GET/POST/PATCH/DELETE /api/settings/webhooks`.

## Data Model Updates
- `Lead`: Added `insights` (Json) field.
- `Tenant`: Includes `webhookSubscriptions`.
- `WebhookSubscription`: New model for managing external delivery targets.
