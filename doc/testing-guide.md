# Replybase SaaS Testing & Performance Strategy

This document outlines the testing strategy, tools, and procedures for ensuring the reliability and performance of the Replybase SaaS platform.

## 1. Overview
Our testing strategy follows the "Testing Pyramid":
- **Unit Tests**: Business logic and utility functions (`vitest`). Target: 90%+ coverage.
- **Integration Tests**: API routes and database interactions (`vitest`).
- **End-to-End (E2E) Tests**: Major user flows, accessibility (`axe-playwright`), and UI shell (`Playwright`).
- **Load Testing**: Performance under stress (`k6`).
- **Security**: Multi-tenant isolation and authentication hardening.

## 2. Automated Tests
### Running Locally
```bash
# Unit & Integration Tests
pnpm test

# E2E Tests
pnpm test:e2e

# Coverage Report
pnpm test:coverage
```

### Key Test Locations
- `tests/lib/`: Unit tests for core logic (Subscription, AI, Webchat).
- `tests/api/`: Integration tests for API endpoints and tenant isolation.
- `tests/e2e/`: Playwright specs for user journeys (Auth, Onboarding, Bots, Billing).
- `tests/webchat/`: Specific tests for the webchat widget and engine.

## 3. Load Testing
We use **k6** for realistic traffic simulation.
- **Scripts**: `load-tests/webchat-load.js` simulates a full user journey (Init -> Message -> Poll).
- **Runner**: `scripts/run-load-tests.ts` captures metrics and saves them to the DB.

### Triggering a Load Test
- **CLI**: `pnpm tsx scripts/run-load-tests.ts`
- **Admin Panel**: Go to `/admin/tests` and click **Trigger Load Test**.

## 4. Admin Test Dashboard (/admin/tests)
The dashboard provides a centralized view for super-admins:
- **Run Health Checks**: Triggers safe production checks for DB and system connectivity.
- **Trigger Load Test**: Runs a background performance test.
- **Performance Trends**: Visualization of p95 latency, throughput (req/s), and error rates.
- **Export CSV**: Download historical test results for audit and compliance.

### Interpreting Metrics
- **p95 Latency**: 95% of requests are faster than this value. Should be < 500ms.
- **Throughput**: Number of successful requests per second.
- **Error Rate %**: Percentage of failed requests. Should be < 1% in normal operation.

## 5. Security & Isolation
Multi-tenant isolation is verified in `tests/api/tenant-isolation.test.ts`.
All API routes MUST use `tenantId` scoping in every database query.

## 6. DigitalOcean & Coolify Considerations
- **Environment Variables**: Ensure `NEXT_PUBLIC_APP_URL` and `ALLOW_PRODUCTION_LOAD_TESTS=true` are set in Coolify for production testing.
- **Resources**: Load tests are configured with ramp-up periods to avoid CPU spikes on smaller droplets.
- **Monitoring**: Integration with `ActivityLog` ensures that failed production tests trigger administrative alerts.

## 7. Maintenance
- **Adding Tests**: New features MUST include unit and integration tests.
- **CI/CD**: All tests run in the pipeline; failures block deployment.
- **Data Safety**: Load tests against production use the `pk_test` public key to avoid polluting real tenant data.
