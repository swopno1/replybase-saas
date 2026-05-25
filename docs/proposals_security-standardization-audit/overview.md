# Proposal: Security Standardization & IDOR Prevention Audit

## Overview
As ReplyBase moves toward enterprise readiness, we must eliminate all manual multi-tenant scoping logic. This proposal outlines the systematic refactoring of legacy API routes and background workers to use the standardized `withAuthAndTenant` and `getTenantPrisma` patterns.

## Identified High-Risk Areas
1. **Background Workers**: `facebook-worker.ts` currently uses the global `prisma` client, increasing the risk of cross-tenant data leakage if manual filters are missed.
2. **Data Utility Layers**: `/api/user/data-export` relies on manual session extraction and filtering.
3. **Legacy Routes**: Approximately 40+ routes in `app/api/flows/`, `app/api/tenant/`, and `app/api/facebook/` still use `getServerSession` instead of the standardized middleware.

## Business Value
- **Zero-Trust Multi-tenancy**: Automated isolation at the database layer.
- **Developer Velocity**: Simplified API handlers with pre-resolved `db` and `user` context.
- **Audit Compliance**: Easier to verify security posture for enterprise customers.

## Implementation Phases
1. **Phase 1 (Workers)**: Refactor all workers in `lib/services/` to use `getTenantPrisma(tenantId)`.
2. **Phase 2 (Export & Admin)**: Standardize data export and admin-shadow routes.
3. **Phase 3 (Bulk Refactor)**: Transition all remaining `getServerSession` routes to `withAuthAndTenant`.

## Risks
- **Session Breaking**: Incorrect refactoring might break authentication for specific routes.
- **Admin Shadowing**: Ensuring that `withAuthAndTenant` correctly handles cases where a Superadmin is impersonating a tenant.
