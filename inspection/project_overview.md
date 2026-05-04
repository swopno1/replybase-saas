# Project Overview - ReplyBase SaaS

## Purpose
ReplyBase is a multi-tenant Software-as-a-Service (SaaS) platform designed to centralize and automate customer communication for small businesses (primarily UK-based). It consolidates messages from various channels—Webchat, Facebook Messenger, Telegram, and WhatsApp—into a single unified inbox, while providing an automated "Flow Engine" and AI-driven responses to handle common queries.

## Core Features
- **Omni-channel Unified Inbox**: A single interface to view and respond to messages from Webchat, Facebook, Telegram, and WhatsApp.
- **Conversational Flow Engine**: A programmable logic engine that executes predefined response trees (flows) to qualify leads, provide information, or perform actions (booking, checkout).
- **AI-Powered Automation**: Integration with major AI providers (Google Gemini, OpenAI, Anthropic) for suggested replies and automated fallback conversations.
- **Multi-Tenant Architecture**: Secure isolation between different business accounts (tenants).
- **Lead Management**: Automatic lead creation and tagging based on conversational interactions.
- **Subscription & Billing**: Tiered access levels (Free, Pro, Business) managed via Stripe integration.
- **Admin Dashboard**: Analytics, system health monitoring, and management tools for platform administrators.

## High-Level Data Flow
1.  **Inbound Message**: A message arrives via a webhook (FB, Telegram, WhatsApp) or a client-side request (Webchat).
2.  **Authentication & Routing**: The request is routed through `proxy.ts` (middleware-like) and API route handlers which verify the tenant and session.
3.  **Persistence**: The message is saved as a `CrmMessage` linked to a `CrmConversation` and `Contact`.
4.  **Processing (Flow Engine)**: The system checks if an active `Flow` is assigned to the channel. If so, the `FlowExecutionEngine` processes the message and determines the next node.
5.  **AI Fallback**: If no flow is active or the flow hands off, the AI service (via `aiFallback`) generates a response based on conversation history and bot context.
6.  **Outbound Response**: The generated response is sent back through the respective channel API and logged in the database.
7.  **Lead Capture**: Interacting users are captured as `Leads` with metadata and tags applied by the flow engine.
