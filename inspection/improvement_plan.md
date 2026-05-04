# Improvement Plan

## Phase 1: Stability and Security (High Priority)
1.  **Fix Failing Tests**: Investigate and resolve the 5 failures in Contacts, Conversations, Message Optimization, and Onboarding.
2.  **Harden Tenant Isolation**: Automate the `tenantModels` list in `lib/prisma-tenant.ts` by introspecting the Prisma schema or using a more robust registration pattern.
3.  **Resolve Critical Scaling Issues**: Replace in-memory `processingLocks` with a distributed lock (e.g., Redis) or database-level idempotency checks.
4.  **Consolidate Prisma**: Sync all Prisma-related packages to version 7.3.0.

## Phase 2: Technical Debt Reduction (Medium Priority)
1.  **Type Safety Sprint**: Systematically replace `any` types with proper interfaces/types, starting with the Flow Engine and AI services.
2.  **Linting Fix**: Address the ~135 ESLint problems, focusing on the `useEffect` warnings.
3.  **Dead Code Cleanup**: Remove defunct AI endpoints and clean up refactor-related comments.
4.  **Implement Structured Logging**: Integrate a library like Winston or Pino to allow for better log levels and external log management (e.g., Datadog, Axiom).

## Phase 3: Performance and Scalability (Medium Priority)
1.  **Asynchronous Message Processing**: Introduce a message queue (e.g., BullMQ) to handle incoming webhooks and AI generation in the background.
2.  **Optimistic UI / Streaming**: Implement streaming for AI responses in the webchat widget to reduce perceived latency.
3.  **Caching Layer**: Add Redis or a similar caching layer for frequently accessed data like subscription status and plan limits.

## Phase 4: Feature Enhancements (Long-term)
1.  **Visual Flow Builder**: Transition from JSON-based flow templates to a visual drag-and-drop editor.
2.  **WhatsApp Onboarding Improvements**: Mature the WhatsApp integration UI to match the Facebook/Telegram experience.
3.  **Multi-Agent Features**: Add agent collision detection and advanced conversation assignment logic.
4.  **Advanced Analytics**: Expand the admin dashboard with more granular tenant-level health and performance metrics.
