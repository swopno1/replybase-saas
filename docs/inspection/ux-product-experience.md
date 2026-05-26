# UX & Product Experience Master Audit - ReplyBase (August 2026)

## 1. Core Experience Pillars
- **Polished Professionalism**: Standardized on shadcn/ui and Geist Typography.
- **Activation-First**: AI-assisted 4-step onboarding that builds momentum by pre-configuring bots.
- **Direct Navigation**: Dashboard Status Cards link directly to management views (Task UX-008).

## 2. Interaction Design
- **Motion**: Standardized Framer Motion transitions (fades, slide-ins).
- **Feedback**: Immediate hover states (`hover:bg-accent`) and cursor-pointer for all interactive elements.
- **Loading States**: Skeleton loaders utilized for core dashboard metrics; expanding to Conversations and Settings (Task UX-003).

## 3. Conversational UX
- **Transparency**: Clear "Bot is drafting..." indicators and handoff statuses in the CRM.
- **Speed**: Streaming AI responses in both Webchat and CRM to minimize perceived latency.
- **Quality**: Context-aware AI responses grounded in bot business knowledge (`ai-fallback.ts`).

## 4. Retention & Engagement
- **Milestones**: "Activation Milestones" system tracks user progress and provides clear setup guidance.
- **Empty States**: Actionable empty states replace generic messages to guide new users to their next action.

## 5. Product Experience Roadmap
1. **Mobile Flow Management (HIGH)**: Implement linearized "Flow Summary" to replace complex mobile editor (Task 012).
- **Real-time CRM (MEDIUM)**: Transition from 5s polling to WebSockets/SSE for a truly "live" feel (Task 033/042). August 2026 inspection confirmed a "steppy" UX and noticeable delays in message appearance.
3. **Collaboration UX (LOW)**: Implement real-time presence indicators to prevent dual-handling of conversations (See `docs/proposals_live-agent-presence/overview.md`).
- **CRM Loading States (MEDIUM)**: The `ConversationPage` currently displays raw "Loading conversation..." text during initial load and polling refreshes. Implementing Skeleton loaders is a priority to improve the "premium" feel of the core CRM experience (Task 050).
- **Accessibility Hardening**: Icon-only buttons in `ConversationHeader` (Mail, Phone) and `ReplyComposer` (Suggest AI) need consistent `aria-label` auditing to match `ConversationsList` standards.
