# Channel Management System Documentation

## Overview

This document describes the modular channel management system implemented to control which communication channels (Facebook, Telegram, WebChat, WhatsApp) are active or inactive in the ReplyBase SaaS application.

**Status:** Facebook is currently **disabled** due to Meta verification failure.

## Architecture

### Two-Level Control System

The channel management system operates at two levels:

#### 1. **System Level** (Environment Variables)

Controls availability at the application/deployment level. Channels disabled at this level cannot be enabled by tenants.

**Configuration:** Environment variables in `.env` or deployment config

```bash
ENABLE_CHANNEL_FACEBOOK=false    # Currently disabled due to Meta verification failure
ENABLE_CHANNEL_TELEGRAM=true
ENABLE_CHANNEL_WEBCHAT=true
ENABLE_CHANNEL_WHATSAPP=false
```

#### 2. **Tenant Level** (Database)

Each tenant can enable/disable individual channels (if enabled at system level).

**Storage:** `TenantChannelStatus` table in PostgreSQL

```json
{
  "tenantId": "...",
  "facebook": false,
  "telegram": true,
  "webchat": true,
  "whatsapp": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Control Flow

```
System Level (Env Vars)
       ↓
   [Disabled?] → 403 Forbidden (Channel not available)
       ↑
       No
       ↓
Tenant Level (DB)
       ↓
   [Disabled?] → Channel unavailable for this tenant
       ↑
       No
       ↓
   ✓ Channel Available
```

## Implementation Details

### 1. Channel Configuration Module

**File:** `lib/channel-config.ts`

Provides utilities to check channel status at the system level:

```typescript
import {
  isChannelEnabled,
  getChannelConfig,
  getEnabledChannels,
  requireChannelEnabled,
} from "@/lib/channel-config";

// Check if a channel is enabled
if (isChannelEnabled("facebook")) {
  // Has access to Facebook features
}

// Get detailed config
const config = getChannelConfig("facebook");
console.log(config.enabled); // false (system level)
console.log(config.notes); // Meta verification failed

// Get all enabled channels
const active = getEnabledChannels(); // ['telegram', 'webchat']

// Require a channel or throw error
try {
  requireChannelEnabled("facebook", "Facebook integration");
} catch (e) {
  console.error(e.message);
}
```

### 2. Authentication Updates

**File:** `lib/auth.ts`

The NextAuth configuration conditionally includes the Facebook OAuth provider:

```typescript
import { isChannelEnabled } from '@/lib/channel-config';

export const authOptions: NextAuthOptions = {
  providers: [
    ...(isChannelEnabled("facebook") ? [FacebookProvider({...})] : []),
    GoogleProvider({...}),
    CredentialsProvider({...}),
  ],
  // ...
};
```

**Effect:** When `ENABLE_CHANNEL_FACEBOOK=false`, users cannot sign in via Facebook.

### 3. API Route Guards

**Files:**

- `app/api/facebook/webhook/route.ts`
- `app/api/facebook/pages/route.ts`
- `app/api/integrations/facebook/route.ts`
- `app/api/facebook/data-deletion/route.ts`
- `app/api/facebook/deauthorize/route.ts`

All Facebook API routes check if the channel is enabled:

```typescript
import { isChannelEnabled } from "@/lib/channel-config";

export async function GET(req: NextRequest) {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }
  // ... rest of handler
}
```

**Effect:** When disabled, all Facebook API endpoints return 403 Forbidden.

### 4. Database Schema

**File:** `prisma/schema.prisma`

New model for tenant-level channel status:

```prisma
model TenantChannelStatus {
  id        String   @id @default(cuid())
  tenantId  String   @unique
  facebook  Boolean  @default(false)
  telegram  Boolean  @default(true)
  webchat   Boolean  @default(true)
  whatsapp  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("tenant_channel_statuses")
}
```

### 5. Tenant Channel Settings API

**File:** `app/api/tenant/channels/route.ts`

Provides endpoints for reading and updating tenant channel preferences:

#### GET /api/tenant/channels

Returns current channel status for the authenticated tenant:

```json
{
  "tenant": {
    "facebook": false,
    "telegram": true,
    "webchat": true,
    "whatsapp": false
  },
  "tenantOnly": {
    "facebook": false,
    "telegram": true,
    "webchat": true,
    "whatsapp": false
  },
  "systemLevel": {
    "facebook": false,
    "telegram": true,
    "webchat": true,
    "whatsapp": false
  },
  "channelConfigs": [...]
}
```

#### PATCH /api/tenant/channels

Update channel preferences for the authenticated tenant:

```bash
PATCH /api/tenant/channels
Content-Type: application/json

{
  "facebook": false,
  "telegram": true,
  "webchat": true,
  "whatsapp": false
}
```

Respects system-level restrictions:

- If `ENABLE_CHANNEL_FACEBOOK=false` at system level, tenant cannot enable it
- Returns error if trying to enable a system-disabled channel

### 6. Dashboard UI

**Files:**

- `app/(dashboard)/settings/channels/page.tsx`
- `app/(dashboard)/settings/channels/channels-client.tsx`

Location: Settings → Channel Management

Features:

- View all channels with their names and descriptions
- See system status (Available / System Disabled)
- Toggle channels on/off (if available at system level)
- Real-time feedback via toast notifications
- Visual indicators for channel status

## Migration Guide

### From Old System

**Previous state:**

- Facebook fields scattered across multiple models and routes
- No centralized channel management
- Manual code changes needed to disable features

**New state:**

- Centralized channel configuration via environment variables
- Tenant-level channel preferences in database
- Dashboard UI for managing channels
- Modular, extensible design

### Disabling Facebook

Facebook is already disabled by default with this system. To ensure it stays disabled:

1. **Environment Variable (System Level):**

   ```bash
   ENABLE_CHANNEL_FACEBOOK=false
   ```

2. **Result:**
   - Facebook OAuth provider removed from NextAuth
   - All `/api/facebook/*` endpoints return 403
   - Facebook fields in UI are hidden or disabled
   - Tenant cannot enable it even if they want to

### Adding a New Channel

To add a new channel (e.g., SMS):

1. **Update `lib/channel-config.ts`:**

   ```typescript
   export type ChannelId = 'facebook' | 'telegram' | 'webchat' | 'whatsapp' | 'sms';

   const CHANNEL_DEFAULTS: Record<ChannelId, ...> = {
     // ... existing
     sms: {
       id: 'sms',
       displayName: 'SMS',
       description: 'SMS text messaging integration',
       envVar: 'ENABLE_CHANNEL_SMS',
     },
   };
   ```

2. **Update `prisma/schema.prisma`:**

   ```prisma
   enum ChannelType {
     web
     facebook
     telegram
     whatsapp
     sms  // Add here
   }

   model TenantChannelStatus {
     // ... existing fields
     sms Boolean @default(false)
   }
   ```

3. **Create migration:**

   ```bash
   npx prisma migrate dev --name add_sms_channel
   ```

4. **Implement channel routes:**
   - Create `/app/api/sms/...` endpoints
   - Guard with `isChannelEnabled('sms')` checks

5. **Add to dashboard:**
   - Update channel references in UI components

## Environment Variables

### System-Level Channel Configuration

```bash
# Facebook - currently disabled due to Meta verification failure
ENABLE_CHANNEL_FACEBOOK=false

# Telegram - enabled
ENABLE_CHANNEL_TELEGRAM=true

# Web Chat - enabled
ENABLE_CHANNEL_WEBCHAT=true

# WhatsApp - disabled for now (future integration)
ENABLE_CHANNEL_WHATSAPP=false
```

### Facebook-Specific Variables (Used Only If Enabled)

```bash
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=verify_token_here
```

**Note:** These variables are only used if `ENABLE_CHANNEL_FACEBOOK=true`.

### Other Channel Variables

Telegram:

```bash
TELEGRAM_TOKEN_ENCRYPTION_KEY=your_key
```

WebChat:

```bash
WEBCHAT_RATE_LIMIT_STORE=upstash  # or in-memory (default)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Monitoring & Debugging

### Check Channel Status

```bash
# View system-level configuration
curl http://localhost:3000/api/tenant/channels \
  -H "Authorization: Bearer $TOKEN"

# Check logs for channel-related operations
grep -r "channel is" logs/
grep -r "ENABLE_CHANNEL" .
```

### Common Issues

**Issue:** Facebook channel not working even when enabled

- Check `ENABLE_CHANNEL_FACEBOOK=true` is set
- Verify `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` are configured
- Check database `TenantChannelStatus.facebook` is true

**Issue:** Channel toggling in UI doesn't work

- Verify `/api/tenant/channels` endpoint returns 200
- Check user has active session
- Check browser console for client-side errors

**Issue:** Facebook OAuth button not showing in login

- Check `ENABLE_CHANNEL_FACEBOOK=false` → expected behavior
- Set to `true` and restart app to enable

## Best Practices

1. **Use the channel config module** instead of checking environment variables directly:

   ```typescript
   // ✓ Good
   if (isChannelEnabled('facebook')) { ... }

   // ✗ Bad
   if (process.env.FACEBOOK_CLIENT_ID) { ... }
   ```

2. **Guard API routes** at the entry point:

   ```typescript
   export async function POST(req: NextRequest) {
     if (!isChannelEnabled("facebook")) {
       return NextResponse.json({ error: "..." }, { status: 403 });
     }
     // ... rest of handler
   }
   ```

3. **Provide user feedback** when channels are unavailable:

   ```typescript
   // In dashboard components
   if (!systemEnabled) {
     return <div>This channel is not available in your deployment</div>;
   }
   ```

4. **Log channel-related decisions**:
   ```typescript
   if (!isChannelEnabled("facebook")) {
     console.warn("[Facebook] Channel is disabled");
   }
   ```

## Future Enhancements

Potential improvements to the channel system:

1. **Feature Flags per Tenant**
   - Allow different feature sets based on subscription tier
   - Example: Pro plan includes all channels, Free plan only Telegram + WebChat

2. **Channel Metrics & Analytics**
   - Track which channels are most used
   - Monitor channel-specific errors and failures

3. **Graceful Degradation**
   - When a channel is disabled mid-conversation, gracefully close connections
   - Notify users about channel transitions

4. **Channel Webhooks**
   - Notify external systems when channels are enabled/disabled
   - Audit logging for compliance

5. **Rate Limiting per Channel**
   - Different rate limits for different channels
   - Tenant-level overrides for high-volume channels

## Support

For issues or questions about the channel management system:

1. Check this documentation
2. Review the channel-config module code
3. Check database `TenantChannelStatus` records
4. Review API route guards
5. Check logs for channel-related errors

## Change Log

- **2026-03-23** - Initial implementation of modular channel management system
  - System-level channel configuration via environment variables
  - Tenant-level channel preferences in database
  - Dashboard UI for channel management
  - Facebook channel disabled by default due to Meta verification failure
