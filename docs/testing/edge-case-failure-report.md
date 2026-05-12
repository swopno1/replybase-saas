# Edge Case Failure Report

## 1. AI Timeout / Provider Failure
- **Issue**: If the primary AI model times out (15s), the system attempts a secondary fallback.
- **Risk**: If both fail, the user receives a generic "agents are busy" message.
- **Resolution**: Implemented robust error catching in `app/api/webchat/message/route.ts` to differentiate between Quota errors and Timeouts.

## 2. Empty Sub-Flows
- **Issue**: If a `call_flow` action references a flow with zero active nodes.
- **Risk**: The orchestrator would stop and show the fallback message.
- **Resolution**: Verified that all V6 templates have valid node structures in the DB.

## 3. ID Concatenation (Idempotency)
- **Issue**: Rapid double-clicks on buttons.
- **Resolution**: Idempotency keys (`lockKey`) in the message route now prevent duplicate outbound processing for 5 minutes.

## 4. Environment Leaks
- **Issue**: Environment variables missing during standalone script execution (e.g., `tsx`).
- **Resolution**: Standardized on `dotenv/config` and explicit variable passing for all test/audit scripts.

---
*Report generated for ReplyBase Engineering.*
