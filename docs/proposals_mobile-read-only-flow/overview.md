# Strategic Proposal: Mobile-First "Flow Summary" Management

## Feature Overview
Implement a lightweight, non-visual alternative to the Flow Editor specifically designed for mobile devices. Instead of a complex 2D tree structure, mobile users will see a linearized "Summary" of the bot's logic.

## Business Value
- **Agility**: Allows business owners to fix typos or adjust welcome messages while away from their desk.
- **Engagement**: Increases daily active usage (DAU) by making the platform more accessible on the go.
- **Retention**: Reduces frustration for users who attempt to manage their bots via smartphone.

## UX Impact
- **Simplicity**: Replaces the cognitive load of a visual graph with a familiar vertical list.
- **Focus**: Prioritizes content editing (text, quick replies) over structural changes (adding nodes, changing connections).
- **Responsiveness**: Eliminates the "zoom-and-pan" struggle on small screens.

## Technical Considerations
- **Detection**: Use CSS media queries or a standard `useMediaQuery` hook to toggle the view.
- **Data Model**: The underlying JSON structure of the Flow remains unchanged; only the presentation layer differs.
- **Synchronization**: Edits made in the summary view must update the same Flow record as the visual editor.

## Rollout Strategy
1. **Phase 1**: Read-only summary view for existing flows.
2. **Phase 2**: "Quick Edit" mode for message node text.
3. **Phase 3**: Ability to re-order nodes via drag-and-drop list.

## Risks
- **Logic Complexity**: Very complex flows with many branches may still be difficult to represent linearly.
- **User Confusion**: Ensuring users understand they are editing the same flow despite the different interface.

## AI-Readable Execution Prompt
"Create a new React component `MobileFlowSummary` that accepts a Flow JSON object and renders it as a vertical list of nodes. Use the `FlowNode` type to determine node styling. Provide a simple text area for editing message content within each node card. Integrate this component into `app/(dashboard)/bots/[id]/edit/page.tsx` using a conditional render for viewports under 768px."
