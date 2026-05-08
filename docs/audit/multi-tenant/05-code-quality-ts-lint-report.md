# Code Quality & Architecture Hygiene

## TypeScript Issues
- **Extensive use of `any`**: Found in critical paths like `lib/prisma-tenant.ts` and `app/api/webchat/message/route.ts`. This masks potential runtime errors in data processing and query building.
- **Prisma Extension Typing**: The `getTenantPrisma` return type is complex and often cast or used with `ReturnType<typeof getTenantPrisma>`. This can lead to type-stripping when passing the client through multiple service layers.

## Technical Debt Hotspots
- **Fat Route Handlers**: Many API routes (`app/api/webchat/message/route.ts`, `app/api/flows/[id]/route.ts`) contain complex business logic, including idempotency checks, AI service calls, and multi-step DB transactions.
- **Recommendation**: Move domain logic to a `services/` layer (`FlowService`, `WebchatService`) to ensure consistent tenant enforcement across API routes, Cron jobs, and Server Actions.

## Architecture Smells
- **Manual Activity Logging**: `recordActivity` is called manually in many POST/PUT/DELETE routes. This is prone to omission.
- **Solution**: Consider a Prisma middleware or extension that automatically records audit logs for mutations on tenant-owned entities.
- **Shared Middleware**: The absence of a global `middleware.ts` for tenant/auth verification means every new route must manually implement checks. This increases the "attack surface" for human error.

## Error Handling Patterns
- **Inconsistency**: Some routes return `NextResponse.json({ error: ... })`, while others use utility wrappers from `lib/api-response.ts`. Inconsistent error shapes can break frontend error handling and make debugging multi-tenant leaks harder.
