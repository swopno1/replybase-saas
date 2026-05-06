# Executive Summary: Multi-Bot Multi-Channel Evolution

## Project Goal
To transition ReplyBase from a single-bot-per-tenant focus to a sophisticated multi-bot platform. This allows users to manage multiple independent AI agents (Bots), each with its own dedicated channel configurations (WhatsApp, Facebook, Telegram, Webchat).

## Key Findings from Deep Inspection
1. **Existing Multi-Bot Support**: The database already supports multiple `Bot` records per `Tenant`.
2. **Channel Constraint Bottleneck**: A unique constraint `@@unique([botId, type])` currently prevents a single bot from having multiple instances of the same channel (e.g., two different WhatsApp numbers).
3. **Global Integration UI**: The current UI treats integrations as a global workspace setting rather than a bot-specific setting.
4. **Routing Scalability**: Webhook routing for WhatsApp and Facebook currently scans tenant-wide, which needs to be hardened for multi-bot lookups.

## Proposed Solution: The Bot-Centric Model
We will move the "Integrations" configuration directly into the "Bot" management flow.

1. **Bot-Specific Integrations**: Each Bot will have a "Channels" tab where users can connect their specific WhatsApp, Facebook, or Telegram accounts.
2. **Deterministic Routing**: Webhooks will use the incoming unique provider ID (e.g., Phone Number ID) to instantly identify the specific Bot responsible for the conversation.
3. **Plan-Based Scalability**: Users can scale their number of bots and channels based on their subscription level (Free, Starter, Pro, etc.).

## Implementation Roadmap
- **Phase 1**: Database schema refactor and data migration. ✅
- **Phase 2**: Refactoring backend APIs to be bot-scoped. ✅
- **Phase 3**: Migrating the Integration UI into the Bot Detail pages.
- **Phase 4**: Updating Webhook handlers and background workers for multi-bot routing.
- **Phase 5**: Enabling strict subscription limit enforcement.

## Documentation Included
- **Detailed Plan**: `docs/proposals/multi-bot-multi-channel.md`
- **Development Prompts**: `docs/proposals/multi-bot-prompts.md`
