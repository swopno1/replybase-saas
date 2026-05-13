# ReplyBase UI/UX Tasks

## Immediate Improvements
- [ ] **UX-001**: Replace generic "No results" with actionable empty states in all tables.
  - Impact: Guides users toward the next positive action.
- [ ] **UX-002**: Standardize icon stroke width (Lucide default) across all navigation and action items.
  - Impact: Improves visual consistency and premium feel.

## Visual Polish
- [ ] **UX-003**: Implement skeleton loading states for the Conversation Detail view.
  - Impact: Eliminates jarring layout shifts during polling/loading.
- [ ] **UX-004**: Add hover transitions to sidebar menu items.
  - Impact: Provides better interactive feedback.

## Advanced UX
- [ ] **UX-005**: Design and implement a "Read-only" summary view for the Flow Editor on mobile.
  - Impact: Improves mobile usability without needing complex editor controls.
- [ ] **UX-006**: Add real-time typing indicators for human handoff in the chat interface.
  - Impact: Professionalizes the chat experience.

- [ ] **UX-007**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Onboarding
  - Issue: Onboarding: Interstitial Loading State.
  - Root Cause: Direct redirect from plan selection to dashboard feels jarring and unpolished.
  - UX/Business Impact: Increases perceived professionalism and allows time for background workspace provisioning.
  - Objective: Add a "Preparing your workspace" interstitial between plan selection and dashboard redirect.
  - Detailed Instructions: Create a new page/component that displays a progress bar and helpful tips while the backend finalizes setup.
  - Expected Deliverables: New interstitial component and updated navigation logic.
  - Dependencies: None.
  - Notes: Use Framer Motion for smooth transitions.
  - Suggested Rollout Risk: LOW.

- [ ] **UX-008**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Dashboard
  - Issue: Interaction: Interactive Dashboard Funnel.
  - Root Cause: Dashboard funnel cards (StatusCards and Activation Milestones) are currently static.
  - UX/Business Impact: Improves navigation flow and guides users to the next setup action instantly.
  - Objective: Make dashboard cards clickable to navigate to relevant settings or integration pages.
  - Detailed Instructions: 1. Update `components/dashboard/status-cards.tsx` to wrap "Connected Channels" and "Lead Alerts" in `Link` components. 2. Update `app/(dashboard)/page.tsx` to wrap Milestone items in `Link` components using their `actionHref`. 3. Add `hover:bg-accent cursor-pointer transition-colors` to the wrapper cards.
  - Expected Deliverables: Updated dashboard layout with interactive cards.
  - Dependencies: None.
  - Notes: Ensure hover states reflect interactivity and use standard shadcn/ui accent colors.
  - Suggested Rollout Risk: LOW.

- [ ] **UX-009**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: CRM
  - Issue: Feedback: Implementation of "AI Thinking" indicators.
  - Root Cause: Users are unaware when the AI fallback is generating a response, leading to perceived silence.
  - UX/Business Impact: Reduces user frustration and signals that the system is active.
  - Objective: Show a "Bot is drafting response..." indicator in the conversation list when AI fallback is active.
  - Detailed Instructions: Update the conversation list component to check for active background jobs related to a conversation ID.
  - Expected Deliverables: Real-time "Thinking" indicator in the dashboard UI.
  - Dependencies: WebSocket or polling mechanism for background job status.
  - Notes: Important for perceived quality.
  - Suggested Rollout Risk: LOW.

- [ ] **UX-010**
  - Priority: LOW
  - Status: PENDING
  - Category: Onboarding
  - Issue: Polish: Success/Celebration states.
  - Root Cause: Successfully completing setup steps (e.g., connecting a channel) feels clinical and lacks positive reinforcement.
  - UX/Business Impact: Increases user "Setup Momentum" and emotional connection to the product.
  - Objective: Add celebratory micro-interactions when milestones are achieved.
  - Detailed Instructions: 1. Use `canvas-confetti` or a Framer Motion celebration effect when a milestone status changes to completed. 2. Show a specific success toast with a "What's Next" recommendation.
  - Expected Deliverables: Celebration effects on the Dashboard and Milestone completion pages.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.
