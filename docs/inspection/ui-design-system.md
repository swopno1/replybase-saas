# UI Design System Master Audit - ReplyBase (August 2026)

## 1. Design Tokens
- **Typography**: Geist Sans (Body), Inter (UI).
- **Colors**: Standardized Tailwind palette using CSS variables (`--primary`, `--muted`, `--accent`, `--destructive`).
- **Radius**: Consistent `0.5rem` on all cards and interactive elements.

## 2. Component Library
- **Core**: Built on `shadcn/ui` (Radix Primitives).
- **DataTable**: Unified component for all list views with integrated filtering, sorting, and pagination.
- **Icons**: `Lucide React` with consistent 2px stroke weight.
- **Inputs**: Standardized form controls with integrated error states.

## 3. Visual Patterns
- **Cards**: Consistent use of `<Card>` components for metrics, bot summaries, and integration details.
- **Modals**: Standardized slide-in sheets or centered dialogs with smooth Framer Motion transitions.
- **Sidebars**: Collapsible navigation with active state highlighting.

## 4. Theme Support
- **Modes**: Full Dark/Light mode support with automated system preference detection.
- **Contrast**: WCAG 2.1 AA compliant contrast ratios maintained across both themes.

## 5. Design System Roadmap
1. **Component Documentation (LOW)**: Create a Storybook or internal docs page for UI components.
2. **Motion Library (MEDIUM)**: Formalize a set of "ReplyBase Motion" primitives for consistent feedback animation.
3. **Mobile Polish (HIGH)**: Optimization of complex data tables for horizontal scroll on mobile.
