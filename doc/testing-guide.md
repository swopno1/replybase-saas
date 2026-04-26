# Replybase SaaS Testing & Performance Strategy

This document outlines the testing strategy, tools, and procedures for ensuring the reliability and performance of the Replybase SaaS platform.

## 1. Overview
Our testing strategy follows the "Testing Pyramid" and includes:
- **Unit Tests**: Business logic and utility functions (`vitest`).
- **Integration Tests**: API routes and database interactions (`vitest`).
- **End-to-End (E2E) Tests**: Major user flows and UI regression (`Playwright`).
- **Load Testing**: Performance under stress (`k6`).
- **Accessibility & Security**: Compliance and data isolation.

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
- `tests/lib/`: Unit tests for core logic.
- `tests/api/`: Integration tests for API endpoints.
- `tests/e2e/`: Playwright specs for user journeys.
- `tests/analytics/`: Tracking and telemetry verification.

## 3. Load Testing
We use **k6** for realistic traffic simulation.
- **Scripts**: Located in `load-tests/`.
- **Runner**: `scripts/run-load-tests.ts`.

### Triggering a Load Test
```bash
# Default webchat load test
pnpm tsx scripts/run-load-tests.ts

# Custom script
pnpm tsx scripts/run-load-tests.ts load-tests/my-test.js "My Custom Test"
```

## 4. Admin Test Dashboard
The `/admin/tests` page provides a centralized view for super-admins:
- **Smoke Tests**: Quick, safe production checks (e.g., DB connectivity).
- **Performance Trends**: Visualization of load test metrics (p50, p95, throughput).
- **History**: Log of all automated and manual test runs.

## 5. Maintenance
- **Adding Tests**: New features MUST include unit and/or integration tests.
- **CI/CD**: All tests run in the CI pipeline; failures block deployment.
- **Data Isolation**: Always use `withAuthAndTenant` or equivalent to ensure tenant data safety.

## 6. Troubleshooting Failures
1. Check `test-results/` for detailed logs and k6 reports.
2. Review Activity Logs for related system events.
3. Use `pnpm test:watch` for iterative debugging.
