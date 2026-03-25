# Documentation Governance Changelog (MVP Production)

Last updated: 2026-03-25
Owner: Product + Engineering Documentation

## Purpose

This changelog records documentation consolidation and governance decisions so new team members can quickly understand where to read and where to write updates.

## Canonical Source-of-Truth Rules

1. Public user-facing product documentation lives in `replybase-frontend/app/docs`.
2. Product planning, roadmap, and production audit notes live in `replybase-saas/Product_Details`.
3. Operational runbooks live in `replybase-saas/extra` only.
4. Deprecated mirror documentation folders are pointer-only, not active authoring locations.
5. Any duplicate content must be removed or replaced by a short pointer to the canonical file.

## Folder Governance Map

- `replybase-frontend/app/docs`: Canonical public documentation for tenants and workspace owners.
- `replybase-saas/Product_Details`: Canonical internal planning and strategic delivery notes.
- `replybase-saas/Product_Details/todo/archive`: Canonical archive for historical production/security/initiative notes.
- `replybase-saas/extra`: Active operational deployment/security runbooks.
- `replybase-frontend/doc`: Legacy pointer area only.
- `replybase-saas/doc`: Legacy pointer area only.
- `replybase-saas/documentation`: Deprecated mirror pointer area only.

## Public Docs (MVP Production) Page-Level Update Summary

The following pages were aligned to a tenant-user MVP production perspective:

- `app/docs/page.tsx`: Reframed docs index categories and positioning for tenant outcomes.
- `app/docs/quick-start/page.tsx`: Clarified setup sequence for Telegram/Webchat-first onboarding.
- `app/docs/features/page.tsx`: Updated value framing for plans, limits, and practical usage.
- `app/docs/implementation/page.tsx`: Rewritten from engineering-heavy status into tenant MVP readiness.
- `app/docs/roadmap/page.tsx`: Kept roadmap context aligned with current channel and rollout priorities.
- `app/docs/security/page.tsx`: Updated to owner/tenant security posture and production-safe operations.
- `app/docs/deployment-plan/page.tsx`: Focused on production rollout readiness and execution.
- `app/docs/deployment-checklist/page.tsx`: Consolidated practical go-live checks.
- `app/docs/typebot-config/page.tsx`: Kept as practical setup guidance for active MVP channel flow.
- `app/docs/onboarding/page.tsx`: Clarified activation path for tenant teams.
- `app/docs/onboarding-implementation/page.tsx`: Centered on implementation steps teams can execute.
- `app/docs/modular-dashboard/page.tsx`: Updated for practical workspace navigation and ownership workflows.
- `app/docs/webchat-progress/page.tsx`: Converted to production-readiness tracking.
- `app/docs/webchat-qa-rollout/page.tsx`: Converted to rollout QA and staged release guidance.

## Consolidation and De-Duplication Completed

- Reduced duplicate content across `replybase-frontend/doc`, `replybase-saas/doc`, and `replybase-saas/documentation`.
- Moved/centralized major production notes into Product_Details archive where applicable.
- Kept `replybase-saas/extra` focused on operational runbooks and removed strategy/documentation drift.

## Canonical Operational Runbooks (replybase-saas/extra)

- `QUICK_START_DEPLOYMENT.md`
- `PRODUCTION_DEPLOYMENT_PLAN.md`
- `DEPLOYMENT_CHECKLIST.md`
- `TYPEBOT_ENGINE_CONFIGURATION.md`
- `WEBHOOK_MONITORING_SETUP.md`
- `SECURITY_MODEL_APPLICATION_LEVEL.md`
- `ENGINE_ACCESS_RESTRICTION_GUIDE.md`
- `MANUAL_TASKS_CHECKLIST.md`
- `POSTGRESQL_SECURITY_FIX.md`
- `DOCUMENTATION_INDEX.md`

## Team Onboarding Guidance

1. If writing public guidance, update `replybase-frontend/app/docs`.
2. If writing strategy or planning notes, update `replybase-saas/Product_Details`.
3. If writing operational procedures, update `replybase-saas/extra`.
4. Do not create new active docs in deprecated mirror folders.
5. When in doubt, add a pointer note instead of duplicating content.

## Verification Snapshot

- Public docs wording was rechecked for stale internal/channel-prior wording and corrected.
- Edited docs pages were validated with diagnostics checks and had no reported errors.
- Final target scans confirmed no remaining stale terms in the reviewed public docs scope.
