# Strategic Proposal: Live Agent Presence & Collaboration

## Overview
The current ReplyBase CRM allows multiple agents to view and reply to the same conversation simultaneously, which often leads to "double-handling" or conflicting responses. This proposal outlines a real-time presence system to signal when an agent is currently viewing or drafting a reply to a conversation.

## Business Value
- **Operational Professionalism**: Prevents confusing customers with multiple conflicting replies.
- **Team Efficiency**: Reduces redundant effort by signaling that a lead is already being handled.
- **Real-time Coordination**: Enables smoother handoffs between agents in high-volume environments.

## UX Impact
- **Presence Indicators**: Avatars appearing in the conversation header showing who else is viewing the page.
- **"Drafting" State**: A notification (e.g., "Sarah is typing a reply...") visible to other agents.
- **Collision Warning**: Visual alert if two agents try to send a reply at the same time.

## Technical Considerations
- **WebSocket/SSE Infrastructure**: Required for low-latency state synchronization across sessions.
- **Redis Presence Store**: Efficiently tracking "Last Seen" and "Currently Viewing" status per conversation.
- **Vercel/Edge Compatibility**: Ensuring the presence system works within the project's deployment model.

## Implementation Phases
1. **Phase 1: Viewing Status**: Simple "Agent X is viewing" signals.
2. **Phase 2: Typing Status**: Real-time drafting indicators.
3. **Phase 3: Collision Prevention**: Optimistic locking or UI blocks when another agent is actively drafting.

## Rollout Strategy
- **Alpha Testing**: Deploy to a single high-volume tenant to test Redis/WebSocket load.
- **Sidecar Presence**: Implement as a non-blocking UI addition that doesn't affect core messaging if it fails.
- **Standardized Webhooks**: Use standardized system-level webhooks for state synchronization.

## AI-readable Execution Prompts
```markdown
1.  **Infrastructure Setup**: Provision a Redis instance for presence tracking (TTL-based).
2.  **API Layer**: Create `/api/presence` endpoint for heartbeat signals and "is typing" events.
3.  **Frontend Hook**: Implement `usePresence(conversationId)` hook to subscribe to real-time events and update UI avatars.
```

## Risks
- **Infrastructure Complexity**: Introducing persistent state management (WebSockets) to a primarily stateless architecture.
- **State Staleness**: Risk of showing an agent as "active" if they close the tab unexpectedly.
