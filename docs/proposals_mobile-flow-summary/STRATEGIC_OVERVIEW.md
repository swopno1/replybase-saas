# Strategic Proposal: Mobile-First "Flow Summary" Management

## 1. Executive Summary
Address the high friction of the current tree-based Flow Editor on mobile devices. Instead of attempting to render a complex visual builder, provide a linearized, non-visual "Flow Summary" list that allows for quick adjustments to bot logic and message content on small screens.

## 2. Business Value
- **Operational Agility**: Users can tweak bot responses, fix typos, or adjust welcome messages while away from their desks.
- **Improved Retention**: Eliminates the frustration of "pinch-to-zoom" editing, reducing friction for mobile-first users.
- **Increased Engagement**: Increases Daily Active Usage (DAU) by making the platform accessible for management on the go.

## 3. UX Impact
- **Simplicity**: Replaces the cognitive load of a 2D visual graph with a familiar, scrollable vertical list of cards (Step 1, Step 2, etc.).
- **Focused Editing**: Prioritizes content editing (text, quick replies) over structural changes. Clicking a node opens a full-screen drawer (using `Vaul`) or modal for text editing.
- **Responsiveness**: Enforces standard touch targets (min 44px) and eliminates layout shifts, ensuring a "Premium" mobile experience.

## 4. Technical Strategy
- **Viewport Detection**: Use a `useMediaQuery` hook or CSS media queries to detect mobile viewports (< 768px).
- **Presentation Layer**: Create a `MobileFlowSummary` component that maps the Flow JSON `nodes` array to a vertical list. The underlying data model remains unchanged.
- **Data Synchronization**: Edits made in the summary view update the same Flow record as the visual editor, ensuring consistency.
- **Implementation**: Integrate into `app/(dashboard)/bots/[id]/edit/page.tsx` using a conditional render.

## 5. Implementation Roadmap
- **Phase 1 (Read-Only)**: Implement the vertical list view for existing flows.
- **Phase 2 (Quick Edit)**: Add "Edit Text" capabilities for Message nodes using drawer/modal interfaces.
- **Phase 3 (Re-ordering)**: Add ability to re-order nodes via drag-and-drop handles.

## 6. Risks & Mitigations
- **Logic Complexity**: Highly branched flows may be difficult to represent linearly. *Mitigation*: Use clear branch indicators and breadcrumbs within the list.
- **User Confusion**: Users might not realize they are editing the same flow. *Mitigation*: Explicitly label the view as "Flow Summary (Mobile View)".

## 7. AI-Readable Execution Prompt
"Create a new React component `MobileFlowSummary` that accepts a Flow JSON object and renders its nodes as a vertical list of cards. Use the `FlowNode` type to determine node styling. Provide a simple text area for editing message content within each node card using a Shadcn Drawer. Integrate this component into `app/(dashboard)/bots/[id]/edit/page.tsx` as a replacement for the main visual editor when the viewport is less than 768px wide."
