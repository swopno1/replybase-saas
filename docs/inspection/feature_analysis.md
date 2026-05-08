# Feature Analysis

## Implemented Features

### 1. Unified Communication Inbox
- **Description**: A single UI to manage conversations from multiple sources.
- **Code Modules**:
  - `app/(dashboard)/conversations/page.tsx`: Main inbox view.
  - `components/conversation/`: Message feed, header, and composer.
  - `lib/conversation-channel-delivery.ts`: Logic to send messages back through the correct channel.

### 2. Multi-Channel Support
- **Facebook Messenger**:
  - `app/api/facebook/webhook/route.ts`: Inbound message handling.
  - `lib/facebook-sender.ts`: Outbound message delivery.
- **Telegram**:
  - `app/api/telegram/webhook/[channelId]/route.ts`: Webhook processing.
  - `lib/telegram-api.ts`: Bot API interactions.
- **WhatsApp**:
  - `lib/whatsapp-provider.ts`: Abstracted provider logic (Meta, Twilio, 360dialog).
- **Webchat**:
  - `app/api/webchat/`: Configuration, events, and messaging endpoints.
  - `lib/webchat-session.ts`: Session management for web visitors.

### 3. Conversational Flow Engine
- **Description**: Visual-style flow execution for automated interactions.
- **Code Modules**:
  - `lib/flow-execution-engine.ts`: The core runner for node-based logic.
  - `lib/flow-runtime-utils.ts`: Utility functions for evaluating conditions and interpolating text.
  - `lib/flow-templates.ts`: Predefined industry-specific templates.

### 4. AI-Powered Fallback & Assistance
- **Description**: Generates automated responses when flows are not handling a query.
- **Code Modules**:
  - `lib/ai-service.ts`: Provider-agnostic AI model fetching.
  - `lib/ai-fallback.ts`: Logic for generating fallback responses.
  - `app/api/conversations/[conversationId]/suggest-reply/route.ts`: AI-assisted agent replies.

### 5. Lead Generation & Management
- **Description**: Captures user info from chats and organizes them as leads.
- **Code Modules**:
  - `lib/services/lead-service.ts`: Core lead logic.
  - `app/(dashboard)/leads/page.tsx`: Lead management UI.
  - `lib/lead-notifications.ts`: Email/Telegram notifications for new leads.

### 6. Subscription & Billing
- **Description**: Tiered pricing, usage limits, and Stripe integration.
- **Code Modules**:
  - `lib/billing-service.ts`: Stripe interaction logic.
  - `lib/subscription.ts`: Plan limit enforcement (messages, bots, flows).
  - `app/api/billing/`: Checkout and webhook handlers.

### 7. Administrative Tools
- **Description**: Platform-wide monitoring and KPI tracking.
- **Code Modules**:
  - `components/admin/`: KPI dashboards, health monitors, and acquisition analysis.
  - `lib/admin-activation-kpis.ts`: Analytics logic.

## Incomplete or Partially Implemented Features
- **WhatsApp Write Support**: While providers are integrated, the full UI flow for WhatsApp onboarding is less mature than Facebook/Telegram.
- **Advanced Flow UI**: The backend supports complex flows, but the visual builder UI is not fully present in the inspected dashboard routes (likely using JSON-based templates for now).
- **Multi-Agent Collaboration**: Assignments are present (`CrmConversation.assigneeId`), but advanced features like agent-to-agent transfers or collision detection are minimal.
- **Lead Export Gaps**: As noted in memory, the UI doesn't always strictly disable export buttons based on subscription flags.
- **External CRM Integrations (Missing)**: No native real-time integration with HubSpot, Salesforce, or Zapier. Leads are "siloed" within ReplyBase.
- **AI Lead Enrichment (Missing)**: Captured leads contain raw enquiry text but lack structured "High Signal" data (budget, urgency) that AI could extract automatically.
