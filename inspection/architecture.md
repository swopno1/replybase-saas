# System Architecture

## Overview
ReplyBase is built as a modern full-stack web application using the Next.js App Router. It follows a service-oriented architecture within a single codebase, leveraging serverless-friendly patterns.

## Frontend Architecture
- **Framework**: React 19 (Server and Client Components).
- **Styling**: Tailwind CSS for utility-first styling.
- **Components**: shadcn/ui (Radix UI) for accessible, modular components.
- **State Management**: Primarily handled through React's built-in state, hooks, and URL state.

## Backend Architecture
- **Environment**: Next.js API Routes (Node.js runtime).
- **ORM**: Prisma for database access.
- **Middleware/Proxy**: A root `proxy.ts` file acts as a centralized gatekeeper for rate limiting, authentication checks, and routing logic before hitting API routes.
- **Multi-Tenancy**: Implemented at the data layer using Prisma extensions (`lib/prisma-tenant.ts`). This automatically injects `tenantId` filters into all queries, preventing cross-tenant data leaks.

## Data Flow & Integration Boundaries
1.  **API Layer**: RESTful endpoints protected by NextAuth.js sessions and subscription-based feature gating.
2.  **Service Layer**: Business logic is encapsulated in `lib/` (e.g., `FlowExecutionEngine`, `BillingService`).
3.  **Channel Integrations**:
    - **Facebook**: Uses Graph API with webhook support. Handles page subscriptions and message delivery.
    - **Telegram**: Uses Telegram Bot API with webhook integration.
    - **WhatsApp**: Multi-provider support (Meta Cloud API, Twilio, 360dialog) abstracted via `lib/whatsapp-provider.ts`.
    - **Webchat**: A custom widget that communicates via `/api/webchat/*` endpoints.
4.  **Database**: PostgreSQL stores users, tenants, conversations, messages, flows, and logs.
5.  **External Services**:
    - **Stripe**: Handles all financial transactions and subscription lifecycle events via webhooks.
    - **AI Providers**: Pluggable architecture supporting Google (Gemini), OpenAI, and Anthropic via the Vercel AI SDK.

## Logic Separation
- **Synchronous Actions**: Simple CRUD operations and dashboard interactions.
- **Asynchronous/Webhook Actions**: Incoming messages from external channels are processed asynchronously via webhooks, triggering the Flow Engine or AI fallback.
- **Background Tasks**: Cron jobs (via `/api/cron/*`) handle periodic maintenance like pruning logs or checking for expired trials.
