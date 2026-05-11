# Strategic Proposal: Mobile-First Flow Summary View

## Overview
Address the high friction of the current tree-based Flow Editor on mobile devices. Instead of attempting to render a complex visual builder, provide a linearized, read-only "Flow Summary" list that allows for quick adjustments to message content.

## Business Value
- **Operational Flexibility**: Users can tweak bot responses or fix typos while away from their desks.
- **Improved Mobile Satisfaction**: Eliminates the frustration of "pinch-to-zoom" editing.

## UX Impact
- **Simplicity**: A vertical list of nodes (Step 1, Step 2, etc.) is easy to scroll and scan.
- **Focused Editing**: Clicking a node opens a full-screen drawer or modal for text editing, avoiding layout shifts.

## Technical Strategy
1. **Viewport Detection**: Use a media query or a `useMediaQuery` hook to detect mobile viewports (< 768px).
2. **Simplified Component**: Create `MobileFlowSummary` that maps the `nodes` array to a simple vertical list.
3. **Modal Editing**: Use the `Vaul` drawer or Shadcn `Dialog` for node-specific content edits.

## Implementation Phases
- **Phase 1**: Read-only vertical list view.
- **Phase 2**: "Edit Text" capabilities for Message nodes.
- **Phase 3**: Node re-ordering via drag-and-drop handles.

## AI Execution Prompt
"Create a new component MobileFlowSummary.tsx that accepts a Flow object and renders its nodes as a vertical list of cards. Use this component in the Flow Editor page as a replacement for the main visual editor when the viewport is less than 768px wide."
