# Identified Issues and Risks

## Critical Issues
1.  **Scaling Hazard (In-Memory Locks)**: Idempotency locks in `app/api/webchat/message/route.ts` use an in-memory `Set`. This fails in multi-instance or serverless environments, potentially causing duplicate message processing and AI charges.
2.  **Security Risk (Tenant Isolation List)**: The manual list of models in `lib/prisma-tenant.ts` is prone to human error. Forgetting to add a new model that contains `tenantId` results in that model being globally accessible (no tenant filtering).
3.  **Failing Tests**: There are 5 known failures in the core test suite (Contacts, Conversations, Message Optimization, Onboarding). A project in this state is not production-ready.

## Major Issues
1.  **AI Latency**: Synchronous AI response generation blocks API requests for 2-10+ seconds.
2.  **Type Safety (Any Types)**: >230 instances of `any` significantly undermine the benefits of TypeScript, especially in the Flow Engine where data structures are complex.
3.  **Synchronous Webhook Processing**: Processing external webhooks (Facebook, WhatsApp) synchronously makes the system vulnerable to timeouts and data loss during traffic spikes.
4.  **Linting Debt**: ~135 ESLint problems, including potential bugs like synchronous state updates in `useEffect`.

## Minor Issues
1.  **Inconsistent UI Gating**: Lead export buttons are not always disabled based on subscription status.
2.  **Prisma Version Mismatch**: `prisma` (7.2.0) and `@prisma/config` (7.3.0) are out of sync.
3.  **Dead AI Code**: Defunct endpoints (`/api/ai/converse`) and refactor comments clutter the codebase.
4.  **Logging**: Lack of a structured logging framework (using `console.log` exclusively).

## Scalability Risks
- **DB Connection Exhaustion**: High risk in serverless environments.
- **Provider Quotas**: Heavy reliance on AI provider quotas without a robust multi-key or multi-provider rotation strategy (beyond simple fallback).
