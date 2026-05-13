# UX & Design Master Audit - ReplyBase SaaS (Updated August 2026)

## 1. Design System Core
- **Framework**: Tailwind CSS for utility-first styling.
- **UI Kit**: shadcn/ui (Radix-based primitives) ensuring robust accessibility and keyboard navigation.
- **Icons**: Lucide React. **Standard**: Use Lucide default stroke weights unless intentionally varied for specific UI context.
- **Typography**: Geist Sans for a clean, modern SaaS aesthetic.
- **Color Tokens**: Standardized `primary`, `muted`, `accent`, and `destructive` tokens are enforced across all components.

## 2. Motion & Feedback Systems
- **Engine**: Framer Motion for all transitions and interactive feedback.
- **Loading States**: Skeleton loaders are implemented for dashboard cards and high-latency data views.
- **Transitions**: Slide-in panels and smooth opacity fades for modals to minimize layout shifts.

## 3. Onboarding & Conversion Flow
- **Strategy**: AI-assisted 4-step onboarding (Refined from 6 steps) that captures business intent and pre-configures bots.
- **Activation Milestones**: "Activation Milestones" system (app/(dashboard)/page.tsx) is the primary driver for user retention, guiding users through setup with clear visual progress.
- **Friction Management**: Plan selection is strategically gated behind onboarding momentum.
- **Success States**: Celebratory micro-interactions (confetti/motion) upon milestone completion to build setup momentum.

## 4. Dashboard & Product UX
- **Layout Hierarchy**: High-density dashboard with quick actions, status overview, and interactive funnel tracking.
- **Responsiveness**: Mobile-first architecture ensures full dashboard usability on small viewports.
- **Standardized Patterns**:
  - Consistent Card layouts for metrics and bot summaries.
  - `DataTable` component for unified filtering and pagination.
  - Actionable Empty States (replacing generic "No results") to guide new users.

## 5. Conversational UX & AI
- **Real-time Interaction**: Streaming AI responses in Webchat and CRM to reduce perceived latency.
- **Handoff Clarity**: Visual indicators when bots are paused for human intervention.
- **AI Indicators**: "Bot is drafting response..." indicators in the conversation list to keep users informed of background processing.

## 6. Strategic UX Roadmap & Improvement Paths
- **Interactive Dashboard Funnel (HIGH)**: Make status cards and milestones clickable to reduce distance to setup actions (Task UX-008).
- **Mobile Flow Management (HIGH)**: Replace complex visual flow editor with a linearized "Flow Summary" list view for mobile (Task 012).
- **Skeleton Expansion (MEDIUM)**: Add missing skeleton loaders to Conversation Detail and Settings views (Task UX-003).
- **Onboarding Polish (MEDIUM)**: Add "Preparing your workspace" interstitial loading state between plan selection and dashboard (Task UX-007).
- **Collaboration UX (LOW)**: Implement real-time presence indicators in the CRM to prevent dual-handling of conversations.

## 7. Accessibility (A11y)
- **Standards**: Target WCAG 2.1 AA compliance.
- **Keyboard Navigation**: Radix UI primitives provide robust support.
- **Aria Labels**: Mandatory on all non-text interactive elements (icon buttons).
