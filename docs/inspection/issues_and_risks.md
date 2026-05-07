# Identified Issues and Risks (REVISED JUNE 2026)

## Resolved Issues

### Critical Issues
1.  **Scaling Hazard (In-Memory Locks)**: [FIXED] Idempotency locks in `app/api/webchat/message/route.ts` now use the `idempotencyKey` Prisma model, ensuring consistency across multi-instance and serverless environments.
2.  **Security Risk (Tenant Isolation List)**: [FIXED] `lib/prisma-tenant.ts` now automatically introspects all Prisma models via DMMF to apply `tenantId` filters, removing human error risks.
3.  **Failing Tests**: [FIXED] Core test suite (315 tests) is fully passing as of June 2026.

### Major Issues
1.  **AI Latency & Synchronous Webhook Processing**: [FIXED] WhatsApp and Facebook webhooks now process message events and AI responses asynchronously using `@vercel/functions`' `waitUntil`, ensuring fast provider responses and high reliability in serverless environments.
2.  **Type Safety (Any Types)**: [IMPROVED] Systematically reduced `any` usage in core services (`lib/prisma-tenant.ts`, `lib/ai-fallback.ts`) and webhook routes.
3.  **Linting Debt**: [REDUCED] Critical ESLint problems in core API routes and utility libraries have been resolved.

### Minor Issues
1.  **Inconsistent UI Gating**: [FIXED] Lead export buttons in `app/(dashboard)/leads/page.tsx` are now correctly disabled based on the `canExport` subscription flag.
2.  **Prisma Version Mismatch**: [FIXED] All Prisma packages are pinned to version 7.8.0.
3.  **Dead AI Code**: [FIXED] Defunct `converse()` function and `/api/ai/converse` endpoint have been removed.
4.  **Logging**: [FIXED] Structured logging using `pino` has been integrated into core webhook and message processing routes.

## Remaining Risks & Scalability Considerations
- **DB Connection Exhaustion**: Still a consideration in high-traffic serverless scenarios; connection pooling is active but requires monitoring.
- **Provider Quotas**: Simple AI fallback is implemented, but a more robust multi-key rotation strategy is still a potential future improvement.
- **Scaling to Millions of messages**: While async processing helps, a dedicated message queue (e.g. SQS/BullMQ) should be considered for extreme scale.
