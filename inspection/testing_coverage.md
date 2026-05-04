# Testing Coverage Audit

## Existing Tests
The project has a robust testing foundation using Vitest and Playwright.
- **Unit Tests (`tests/lib/`)**: Covers core utilities like `admin.ts`, `subscription.ts`, `whatsapp-provider.ts`, and `flow-runtime-utils.ts`.
- **Integration Tests (`tests/api/`)**: Validates API behaviors for contacts, leads, and tenant isolation.
- **E2E Tests (`tests/e2e/`)**: Playwright tests for auth, billing, bot management, and the webchat widget.
- **Specialized Tests**: Accessibility checks (`axe-playwright`) and security-specific tests.

## Testing Gaps
- **Prisma Client Logic**: The `lib/flow-runtime-utils.ts` functions that interact with the database (e.g., `loadAccessibleFlow`) currently lack unit tests because they require complex Prisma mocking.
- **Webchat Message Edge Cases**: While basic integration tests exist for webchat routes, more complex scenarios like concurrent messages or provider failures (AI timeout) could use more coverage.
- **Admin Dashboards**: UI tests for the platform admin components are sparse.
- **Stripe Webhook Handlers**: Testing the full lifecycle of a subscription (success, failure, cancellation) in an automated way is difficult and appears to have gaps.

## Coverage Quality
- **High Coverage Areas**: `whatsapp-provider.ts`, `flow-runtime-utils.ts` (pure functions), and `subscription.ts` are well-tested.
- **Low Coverage Areas**: Onboarding API logic and multi-channel message delivery paths have reported failures or missing coverage.

## Recommendations
- Implement a robust Prisma mocking strategy to test database-interactive functions.
- Fix the existing 5 failing tests identified in the May 2026 report (Contacts, Conversations, Message Optimization, Onboarding).
- Add load tests for the Flow Engine and AI fallback routes to identify performance regressions.
