# Strategic Proposal: CRM Real-time Sync (WebSockets/SSE)

## Feature Overview
Transition the ReplyBase CRM from 5-second interval polling to a real-time event-driven architecture using WebSockets or Server-Sent Events (SSE). This will ensure that messages, notes, and status changes are reflected instantly across all active agent dashboards.

## Business Value
- **Operational Efficiency**: Prevents agent collision by showing real-time "Drafting" and "Viewing" indicators.
- **Improved CX**: Faster response times for customers as agents see incoming messages the moment they arrive.
- **Scalability**: Reduces unnecessary "Empty Polling" requests to the server, especially as the number of active agents grows.

## UX Impact
- **Instant Messages**: Messages appear without a 5-second delay.
- **Presence Indicators**: Show "Agent X is typing..." or "Agent Y is viewing this conversation."
- **Seamless Handoff**: Visual confirmation of bot-to-human handoff is instantaneous.

## Technical Considerations
- **Provider Choice**: Socket.io for robust WebSocket support or native SSE for simpler uni-directional updates.
- **Infrastructure**: Requires Redis for pub/sub if scaling across multiple server instances.
- **Client Logic**: Update `ConversationPage` and `MessageFeed` to listen for events instead of using `setInterval`.

## Rollout Strategy
1. **Phase 1**: Implement real-time message delivery (uni-directional SSE).
2. **Phase 2**: Implement bi-directional presence indicators (WebSockets).
3. **Phase 3**: Real-time dashboard metric updates.

## Risks
- **Connection Management**: Handling reconnections and stale presence indicators.
- **Resource Usage**: Long-running connections require careful server-side resource management.

## Implementation Phases
- **Sprint 1**: Pub/Sub infrastructure setup with Redis.
- **Sprint 2**: Real-time message streaming in `ConversationPage`.
- **Sprint 3**: Presence and Typing indicators.

## AI-Readable Execution Prompts
```
1. Setup a basic SSE endpoint at /api/conversations/[id]/stream.
2. Integrate with Redis Pub/Sub to broadcast CrmMessage creation events.
3. Update ConversationPage.tsx to use EventSource for real-time updates.
4. Remove the 5000ms setInterval polling.
```
