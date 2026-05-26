# ReplyBase UI/UX Task List - Interaction Intelligence Hub

## 1. Dashboard & Navigation

- **Task UX-008**
  - Priority: MEDIUM
  - Status: IN_PROGRESS
  - Category: Dashboard
  - Severity: MEDIUM
  - Issue: Static Dashboard Experience.
  - Root Cause: Dashboard cards and milestones are currently non-interactive.
  - Business Impact: Higher friction to setup; users must manually find settings.
  - Objective: Transform dashboard cards and milestones into interactive navigation elements.
  - Detailed Instructions: 1. Update `status-cards.tsx` to wrap cards in `Link` components. 2. Use `cursor-pointer` and `hover:bg-accent` styles. 3. Link milestones directly to their setup actions.
  - Expected Deliverables: Interactive, clickable dashboard funnel.
  - Dependencies: None.
  - Notes: High impact on "Time to Value".
  - Rollout Risk: LOW.

- **Task UX-001**
  - Priority: LOW
  - Status: PENDING
  - Category: Layout
  - Severity: LOW
  - Issue: Generic "No results" empty states.
  - Root Cause: Lack of actionable guidance for empty datasets.
  - Business Impact: Confuses new users in fresh accounts.
  - Objective: Replace generic "No results" with actionable empty states platform-wide.
  - Detailed Instructions: Create a reusable `EmptyState` component with Icon, Title, Description, and primary CTA (e.g., "Create your first bot").
  - Expected Deliverables: Reusable component and implementation in all main tables.
  - Dependencies: None.
  - Notes: Standardize across Bots, Contacts, Conversations.
  - Rollout Risk: LOW.

## 2. Polish & Perceived Performance

- **Task UX-003**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Performance
  - Severity: MEDIUM
  - Issue: Missing skeleton loaders in Detail views.
  - Root Cause: Jarring layout shifts during asynchronous data fetching.
  - Business Impact: Perceived slowness and degraded premium feel.
  - Objective: Implement skeleton loading states for Conversation Detail and Settings views.
  - Detailed Instructions: 1. Create skeleton primitives matching the detail view layouts. 2. In `app/(dashboard)/conversations/[conversationId]/page.tsx`, replace the `Loading conversation...` text with the new skeleton loader (See Task 050).
  - Expected Deliverables: Skeleton components for core detail views.
  - Dependencies: None.
  - Notes: High impact on perceived speed. Tracked as part of Task 050.
  - Rollout Risk: LOW.

- **Task UX-002**
  - Priority: LOW
  - Status: PENDING
  - Category: Polish
  - Severity: LOW
  - Issue: Inconsistent icon stroke weights.
  - Root Cause: Ad-hoc icon usage without design system enforcement.
  - Business Impact: Visual noise and lack of design coherence.
  - Objective: Standardize icon stroke width (Lucide default) across the platform.
  - Detailed Instructions: Audit all Lucide icon imports; ensure no custom `strokeWidth` overrides exist unless intentional.
  - Expected Deliverables: Consistent visual iconography.
  - Dependencies: None.
  - Notes: Improves brand professionality.
  - Rollout Risk: LOW.

## 3. Onboarding & Feedback

- **Task UX-007**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Onboarding
  - Severity: MEDIUM
  - Issue: Jarring redirection after plan selection.
  - Root Cause: Direct redirect from pricing to dashboard feels clinical.
  - Business Impact: Missed opportunity to build brand excitement and reassure users.
  - Objective: Add a "Preparing your workspace" interstitial loading state.
  - Detailed Instructions: Create a dedicated interstitial page with a progress bar and "Pro Tips" during workspace provisioning.
  - Expected Deliverables: New interstitial route and updated navigation logic.
  - Dependencies: None.
  - Notes: Use Framer Motion for smooth transitions.
  - Rollout Risk: LOW.

- **Task UX-009**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: CRM
  - Severity: LOW
  - Issue: Missing "AI Thinking" indicators.
  - Root Cause: Users unaware when AI is generating a background response.
  - Business Impact: Potential for agent collision or user frustration.
  - Objective: Show "Bot is drafting response..." indicator in the conversation list.
  - Detailed Instructions: Update the conversation list to check for active background jobs related to a conversation ID via WebSocket or polling.
  - Expected Deliverables: Real-time "Thinking" indicator in the dashboard.
  - Dependencies: WebSocket/Polling mechanism.
  - Notes: Essential for collaborative CRM.
  - Rollout Risk: LOW.

- **Task UX-010**
  - Priority: LOW
  - Status: PENDING
  - Category: Onboarding
  - Severity: LOW
  - Issue: Lack of setup success celebration.
  - Root Cause: Completing milestones feels clinical.
  - Business Impact: Lower "Setup Momentum" and emotional engagement.
  - Objective: Add celebratory micro-interactions when milestones are achieved.
  - Detailed Instructions: Integrate `canvas-confetti` or Framer Motion celebration effects on milestone status change.
  - Expected Deliverables: Celebration effects on Dashboard.
  - Dependencies: None.
  - Notes: Drives user dopamine and retention.
  - Rollout Risk: LOW.

## 4. Mobile & Advanced UX

- **Task UX-011**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Mobile
  - Severity: MEDIUM
  - Issue: Visual Flow Editor is unusable on mobile.
  - Root Cause: Complex canvas-based UI doesn't scale to small viewports.
  - Business Impact: Blocks users from making quick bot adjustments on-the-go.
  - Objective: Implement a read-only "Flow Summary" list view for mobile.
  - Detailed Instructions: 1. Detect mobile agent. 2. Replace visual editor with a linearized list of nodes. 3. Allow text-only edits via modals. Verified visual editor is currently the only logic editing interface.
  - Expected Deliverables: Mobile-optimized flow summary view.
  - Dependencies: None.
  - Notes: Also tracked as Task 012 in master list.
  - Rollout Risk: LOW.

- **Task UX-012**
  - Priority: LOW
  - Status: PENDING
  - Category: CRM
  - Severity: LOW
  - Issue: Agent Collision in CRM.
  - Root Cause: Lack of real-time presence indicators.
  - Business Impact: Multiple agents may reply to the same lead simultaneously.
  - Objective: Implement real-time presence indicators in the Conversation Detail view.
  - Detailed Instructions: Show "Agent X is viewing this conversation" avatars using WebSockets.
  - Expected Deliverables: Presence avatars in CRM.
  - Dependencies: WebSocket infrastructure.
  - Notes: Critical for teams.
  - Rollout Risk: LOW.

- **Task UX-013**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Accessibility
  - Severity: LOW
  - Issue: CRM Accessibility Hardening.
  - Root Cause: Icon-only buttons lack `aria-label` or descriptive text in `ConversationsList` and Detail views.
  - Business Impact: Non-compliant with WCAG 2.1; prevents screen reader users from effectively using the CRM.
  - Objective: Add descriptive ARIA labels to all icon-only triggers.
  - Detailed Instructions: 1. Audit `components/conversation/` (e.g., `ConversationsList` MoreHorizontal trigger). 2. Add `aria-label` or `sr-only` text to each trigger in Header and Composer.
  - Expected Deliverables: Accessible CRM interface.
  - Dependencies: None.
  - Notes: Identified as incomplete for Header and Composer in August 2026 audit.
  - Rollout Risk: LOW.

- **Task UX-014**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: CRM
  - Severity: LOW
  - Issue: Lack of Agent Composition Feedback.
  - Root Cause: No "Typing..." indicator when an agent is composing a reply in the CRM.
  - Business Impact: Improved team collaboration; prevents agents from stepping on each other's toes.
  - Objective: Implement a real-time "Agent is typing..." indicator in the CRM.
  - Detailed Instructions: 1. Emit a "typing" event from `ReplyComposer` via WebSocket/SSE when the input is focused or changed. 2. Listen for these events in `MessageFeed` and display a "Typing..." bubble for other agents.
  - Expected Deliverables: Real-time agent typing feedback.
  - Dependencies: WebSocket/SSE infrastructure.
  - Notes: Complements Task UX-009 ("Bot is thinking...").
  - Rollout Risk: LOW.
