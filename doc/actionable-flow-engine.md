# Actionable Business Flows Engine

The Replybase flow engine has been extended to support actionable nodes to facilitate critical sales motions such as booking, scheduling, and checkout across various channels (Webchat, WhatsApp, Facebook).

## New Node Action Types

Action nodes in `FlowNodeContent` can now take the following string literals:
- `booking`: Used to facilitate service or table reservations.
- `checkout`: Used to facilitate ecommerce product purchases.
- `schedule`: Used to facilitate scheduling appointments or consultations.

### Action Node Properties

Along with these new actions, new properties are supported to capture external data:
- `bookingService` (string): Specifies the internal service name or category (e.g. `table`, `general`).
- `checkoutUrl` (string): Specifies the external URL to direct users to for purchase (e.g., Stripe checkout link).
- `scheduleLink` (string): Specifies the external URL to direct users to for scheduling (e.g., Calendly link).

### Cross-Channel Support

When a `booking`, `checkout`, or `schedule` action fires in `executeActionNode` (located in `lib/flow-execution-engine.ts`), the system identifies the lead by querying `facebookUserId`, `whatsappUserId`, or `contactId` depending on the channel origination, meaning actions are inherently multi-channel out of the box.

### Tracking & Future Extensibility

When an action node fires:
1. The lead's status is automatically bumped to `contacted`.
2. A diagnostic tag (e.g., `booking-initiated`) is merged into the lead's tags, along with any contextual `tags` manually passed in the node (e.g., `["restaurant-booking"]`).
3. External integrations: External integrations (like Stripe/Calendly) can hook into this pipeline via the action handler in `lib/flow-execution-engine.ts`.
