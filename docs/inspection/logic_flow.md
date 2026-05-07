# Logic Flow Analysis

## End-to-End Flow: Incoming Message (Webchat)

1.  **User**: Types a message in the Webchat widget.
2.  **Frontend**: Sends a POST request to `/api/webchat/message`.
3.  **API Handler (`app/api/webchat/message/route.ts`)**:
    - Validates CORS and session token.
    - Checks for concurrent duplicates (idempotency).
    - Persists the message as `inbound` in `CrmMessage`.
    - Identifies the active `Channel` and `Bot`.
4.  **Flow Engine (`lib/webchat-conversation-engine.ts`)**:
    - Attempts to execute an assigned `Flow`.
    - If a flow node matches (or it's an ongoing session), the `FlowExecutionEngine` processes it.
    - If handled, generates `outbound` messages and updates the `FlowSession`.
5.  **AI Fallback (if flow doesn't handle)**:
    - If the flow engine returns `handled: false`, the route calls `aiFallback`.
    - `aiFallback` (in `lib/ai-fallback.ts`) retrieves conversation history.
    - It calls the selected AI provider (Gemini/OpenAI/Anthropic).
6.  **Response Construction**:
    - The generated text is saved as an `outbound` message.
    - The API returns a JSON response containing the message(s) to the frontend.
7.  **Frontend**: Displays the response to the user.

## Complexity & Bottlenecks
- **Waterfall Processing**: The sequence of (Check Flow) -> (Wait) -> (Check AI) -> (Wait) can lead to high latency for the end-user, especially if the AI provider is slow.
- **Database Contention**: Every message triggers multiple DB writes (Inbound message, Session update, Outbound message, Lead update). High-traffic bots could cause performance issues on the database.
- **Idempotency Locks**: The use of an in-memory `Set` (`processingLocks`) for idempotency in a serverless environment (Next.js API routes) is unreliable. If the instance scales or restarts, the lock is lost. A distributed lock (e.g., Redis) is needed for true production readiness.

## Unclear Logic
- **Tenant Isolation Maintenance**: The manual list of models in `lib/prisma-tenant.ts` is a "ticking time bomb" for security if developers forget to update it when adding new features.
- **Flow vs. AI Handover**: The logic for exactly *when* a flow should stop and AI should take over is somewhat opaque and depends on the specific node types and "fallback" configurations within the JSON flow definitions.
