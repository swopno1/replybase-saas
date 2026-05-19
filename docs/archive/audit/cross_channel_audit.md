# Cross-Channel Context Audit

> "Your customer can move from Website → Messenger → WhatsApp and your team never loses context."

## Issues Found

### 🔴 CRITICAL: Missing `leadService` import in `facebook-worker.ts`
- **Line 67** calls `leadService.syncContactIdentifiedStatus()` but `leadService` is **never imported**.
- This will cause a **runtime crash** (`ReferenceError: leadService is not defined`) on every Facebook Messenger message.

### 🔴 CRITICAL: Missing `leadService` import in `telegram-worker.ts`
- **Lines 62 and 111** call `leadService.syncContactIdentifiedStatus()` but `leadService` is **never imported**.
- Same crash risk as above for every Telegram message.

### 🟡 MODERATE: Cross-channel AI history gated behind Pro/Business plan
- In `ai-fallback.ts` **line 100**, cross-channel context is wrapped in `if (plan.includes("pro") || plan.includes("business"))`.
- **Free and Starter** plan users get **zero cross-channel context** in AI responses.
- This means a Free-tier customer moving from Website → WhatsApp will lose all AI context.
- The *identity stitching* still works (DB records merge), but the AI won't reference prior conversations.

### ✅ VERIFIED: `contact-stitching.ts` — Correct
- Properly finds anonymous session by `sync_hash`
- Merges identities, profile data, and conversation history
- Creates activity log notification
- Marks session as stitched

### ✅ VERIFIED: `whatsapp-worker.ts` — Correct
- Has proper `leadService` import (line 20)
- SYNC_ handshake at top of function
- `syncContactIdentifiedStatus` after contact resolution (line 114)

### ✅ VERIFIED: `webchat-conversation-engine.ts` — Correct
- Has `leadService` import (line 16)
- Generates `sync_hash` in `startFlowSession`
- Returns `syncHash` in execution result
- Calls `syncContactIdentifiedStatus` in `persistLeadCapture`

### ✅ VERIFIED: `suggest-reply/route.ts` — Correct
- Fetches contact → conversations → messages (nested include)
- Flattens and sorts messages across all channels
- Channel labels in prompt (`[WEB]`, `[WHATSAPP]`, etc.)

### ✅ VERIFIED: `webchat/message/route.ts` — Correct
- Passes `syncHash` through in meta response
