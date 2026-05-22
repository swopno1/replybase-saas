# Motion System Report - ReplyBase (August 2026)

## 1. Current Implementation
- **Library**: Framer Motion.
- **Patterns**:
  - **Fades**: Used for modal overlays and skeleton transitions.
  - **Slide-ins**: Standard for mobile menus and side sheets.
  - **Staggered Lists**: Implemented in some dashboard metrics for a "pop" feel.

## 2. Interaction Feedback
- **Hover**: Standardized `hover:bg-accent` and scale transitions on metric cards.
- **Loading**: Pulse animations for all Skeleton loaders.
- **Action Success**: Proposed celebration micro-interactions (confetti) upon onboarding completion.

## 3. Motion Guidelines
- **Duration**: Target 200-300ms for UI transitions.
- **Easing**: `easeInOut` or `spring` for natural feel.
- **Accessibility**: Support for `prefers-reduced-motion` should be audited across core components.
