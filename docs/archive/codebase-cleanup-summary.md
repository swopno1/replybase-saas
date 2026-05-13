# Codebase Cleanup Audit: Executive Summary

This audit identifies significant opportunities to reduce technical debt, bundle size, and architectural complexity.

## Key Findings

1.  **Unused Files**: Over 20 files (components, scratch scripts, legacy library logic) are identified as safe to delete.
2.  **API Duplication**: Critical duplication in Facebook integration routes (`/api/integrations/facebook` vs `/api/bots/[botId]/channels/facebook`).
3.  **UI Bloat**: Several ShadCN primitives were added but never used.
4.  **Client Component Overuse**: 81% of components are client-side. There is potential to convert some to server components.
5.  **Dependency Purge**: `@tabler/icons-react` and `tw-animate-css` are candidates for removal.

## Action Plan

### Phase 1: Immediate Cleanup (Zero Risk)
- Delete all files in `/scratch`.
- Delete unused components identified in `01-unused-files.md`.
- Remove `LegacyOnboardingData` and associated types.
- Uninstall `@tabler/icons-react`.

### Phase 2: Refactoring & Consolidation
- Consolidate all Facebook integration logic to the bot-specific routes.
- Merge overlapping utility functions in `lib/facebook-sender.ts` and `lib/server/facebook-utils.ts`.
- Audit Webchat modules for potential consolidation.

### Phase 3: Optimization
- Convert simple UI components from Client to Server components.
- Implement dynamic imports for heavy libraries (Recharts, Dnd-kit).

## Detailed Reports
- [Unused Files](./01-unused-files.md)
- [Component Audit](./02-component-audit.md)
- [API Route Audit](./03-api-audit.md)
- [Library & Utility Audit](./04-lib-audit.md)
- [Type Audit](./05-type-audit.md)
- [Dependency Audit](./06-dependency-audit.md)
