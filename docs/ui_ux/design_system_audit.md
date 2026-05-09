# Design System Audit

## Consistency
- **Buttons**: Consistent use of `default`, `outline`, and `destructive` variants.
- **Inputs**: Uniform styling for forms across onboarding and settings.
- **Badges**: Effective use of color-coded badges for status (`Enabled`, `Active`, `New`).

## Component Library
- **DataTable**: Robust, supports pagination and multi-selection. Needs custom empty state components.
- **Modals**: Standardized `ConfirmationProvider` used for sensitive actions (Delete Bot, Delete Conversation).
- **Skeletons**: Good coverage for main pages; need extension to detail pages.

## Design Debt
- **Icons**: Mostly Lucide-react; ensure consistent stroke width and sizing across all views.
- **Spacing**: Some mobile views have tight padding in the navigation sidebar.
