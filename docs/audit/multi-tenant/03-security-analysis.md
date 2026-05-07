# Security Analysis (Tenant-Centric)

## Authentication Weaknesses
- **NextAuth Session Structure**: The `tenantId` is baked into the JWT. While efficient, it creates a delay in access revocation if a user is removed from a tenant or if tenant permissions change, as the session is refreshed every 15 minutes (`FIFTEEN_MINUTES` constant in `lib/auth.ts`).
- **Facebook Login Gap**: `FacebookProvider` profile callback sets `tenantId: ""`. This relies on the `createUser` adapter logic to patch it. If the adapter logic fails or is bypassed during account linking, users might end up with unassigned or broken tenant contexts.

## Authorization Gaps
- **Admin vs. Superadmin**: The system has `USER`, `ADMIN`, and `SUPERADMIN` roles.
  - `SUPERADMIN` (`isAdmin: true`) can access global flows and admin routes.
  - **Risk**: Some admin endpoints (`app/api/admin/users/route.ts`) use `isPlatformAdmin(session)`. Ensure this check is strictly enforced on *all* `/api/admin/*` routes.
- **Role Escalation**: `app/api/flows/route.ts` contains logic that auto-promotes a user to `isAdmin` if `adminCount === 0`. This is a useful bootstrap feature but could be exploited if the database is in a partial state or during race conditions in a fresh deployment.

## IDOR Risks
- **Bot/Channel Management**: Routes like `app/api/bots/[botId]/channels/[channelId]/route.ts` use `findFirst` to validate ownership. However, the subsequent `update` or `delete` often uses the `id` alone.
- **Exploit Scenario**: If the `findFirst` validation has a logic error (e.g., handling `isGlobal` objects), an attacker can perform actions on resources they don't own by providing a target `id`.

## API Exposure Risks
- **Webhook Endpoints**: `/api/whatsapp/webhook`, `/api/facebook/webhook`, and `/api/telegram/webhook` are public. They use provider-specific signatures (X-Hub-Signature, Twilio Signature).
- **Leakage**: The logs (`WebhookLog`) are stored globally. Ensure that `WebhookLog` access in the Admin UI is strictly limited to `SUPERADMIN` as they may contain sensitive PII from multiple tenants.

## Role Escalation Vectors
- **Tenant Switching**: There is no explicit mechanism for "Switch Tenant" in the session logic besides re-authentication. If added, it must invalidate all active tokens for the previous tenant.
