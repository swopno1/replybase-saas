# Accessibility (A11y) Audit - ReplyBase SaaS (August 2026)

## 1. Foundation
- **Primitives**: Radix UI (via shadcn/ui) handles focus management, ARIA attributes, and keyboard trapping for modals and dropdowns.
- **Navigation**: Keyboard tab-navigation is logical across the dashboard.

## 2. Compliance Gaps
- **Contrast**: Generally good, though some "Muted" text in the activity log may fall below WCAG AA standards (4.5:1).
- **Labels**: Several icon-only buttons (e.g., in the Conversation detail) lack `aria-label` or `title` attributes.
- **Images**: Logo and avatars need consistent `alt` text enforcement.

## 3. Remediation Plan
1. **ARIA Audit**: Add labels to all Lucide-only triggers.
2. **Contrast Pass**: Adjust `text-muted-foreground` for better readability in dark/light modes.
3. **Alt Text Enforcement**: Ensure `Logo` and `UserAvatar` components require non-empty alt tags.
