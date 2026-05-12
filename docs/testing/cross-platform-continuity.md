# Cross-Platform Continuity & Identity Stitching

## Concept
ReplyBase ensures that a user's conversation history and profile are maintained even as they switch between different messaging channels (Webchat, WhatsApp, Facebook, Telegram).

## How it Works

### 1. The Anonymous Phase (Webchat)
When a user visits a website with the ReplyBase Webchat widget, they are assigned a `visitorId`. Any interaction they have is stored under an "Anonymous Contact".

### 2. The Identity Handshake
To "stitch" this anonymous session to a permanent social identity (like WhatsApp), the user can be provided with a **Sync Code** or a **Magic Link**.

- **Sync Code**: The AI can say "Continue this chat on WhatsApp by sending 'SYNC_{ID}' to our number".
- **Magic Link**: A button that opens WhatsApp with a pre-filled message.

### 3. Stitching Logic
When the WhatsApp Webhook receives a message starting with `SYNC_`:
1. It extracts the `sessionHash` (the ID).
2. It calls `stitchContactIdentities`.
3. The system finds the Webchat contact associated with that hash.
4. It transfers all identities (visitor IDs), conversation history, and lead variables to the new WhatsApp-linked contact.
5. The original Webchat session is closed and marked as "Stitched".

## Identity Resolution Order
When a message arrives on any channel, the system resolves identity in this order:
1. **Direct Match**: Does this `wa_id`, `psid`, or `telegram_id` already exist?
2. **Phone/Email Match**: If the user provided a phone/email in Webchat, can we find them by that?
3. **Manual Handshake**: `SYNC_` code.

## Preserved Context
- **AI Memory**: The AI keeps the `FlowSession` variables, so it knows what was already discussed.
- **Lead Status**: If the user was marked as "Interested" on Webchat, they remain "Interested" on WhatsApp.
- **Tags**: All CRM tags are carried over.

---
*Documentation for ReplyBase Omnichannel Engineering.*
