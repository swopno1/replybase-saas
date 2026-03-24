# Facebook Channel Inactivation & Modular Channel Management

## Quick Start - Disabling Facebook

To keep Facebook disabled (current status due to Meta verification failure):

```bash
# In .env or your deployment config:
ENABLE_CHANNEL_FACEBOOK=false  # ← Facebook stays disabled
```

That's it! All Facebook features are automatically disabled:

- Facebook OAuth sign-in option is hidden
- All `/api/facebook/*` routes return 403 Forbidden
- Dashboard shows Facebook as "System Disabled"
- No code changes required

## Quick Start - Re-enabling Facebook (When Ready)

When Meta verification is complete, simply change the environment variable:

```bash
ENABLE_CHANNEL_FACEBOOK=true
```

Restart the app and Facebook will be fully available:

- Facebook OAuth sign-in is enabled
- All `/api/facebook/*` routes become active
- Tenants can toggle Facebook on/off in settings
- Dashboard shows Facebook as "Available"

## What Changed

### New Files Created

- `lib/channel-config.ts` - Central channel configuration module
- `app/api/tenant/channels/route.ts` - Channel management API endpoints
- `app/(dashboard)/settings/channels/page.tsx` - Settings page for channel management
- `app/(dashboard)/settings/channels/channels-client.tsx` - Interactive UI component
- `doc/CHANNEL_MANAGEMENT_SYSTEM.md` - Complete documentation

### Files Updated

- `lib/auth.ts` - Facebook provider now conditional on `ENABLE_CHANNEL_FACEBOOK`
- `app/api/facebook/webhook/route.ts` - Added channel status check
- `app/api/facebook/pages/route.ts` - Added channel status check
- `app/api/integrations/facebook/route.ts` - Added channel status check
- `app/api/facebook/data-deletion/route.ts` - Added channel status check
- `app/api/facebook/deauthorize/route.ts` - Added channel status check
- `prisma/schema.prisma` - Added `TenantChannelStatus` model
- Migration created: `20260321184722_add_tenant_channel_status_model`

## Channel System Architecture

Two-level control system:

```
System Level (Environment Variables)
  ↓ Controls what channels exist
Tenant Level (Database TenantChannelStatus)
  ↓ Controls what each tenant can use
```

### System Level Channels (Environment Variables)

- `ENABLE_CHANNEL_FACEBOOK=false` (disabled due to Meta verification)
- `ENABLE_CHANNEL_TELEGRAM=true` (enabled)
- `ENABLE_CHANNEL_WEBCHAT=true` (enabled)
- `ENABLE_CHANNEL_WHATSAPP=false` (disabled for now)

### Tenant Level Channels (Database)

- Each tenant has a `TenantChannelStatus` record
- Can disable any channel that's enabled at system level
- Cannot enable a channel disabled at system level

## Usage Examples

### Check if a channel is enabled (backend code)

```typescript
import { isChannelEnabled } from "@/lib/channel-config";

if (isChannelEnabled("facebook")) {
  // Facebook is available - proceed
} else {
  // Facebook is not available
  return NextResponse.json({ error: "Channel disabled" }, { status: 403 });
}
```

### Get all enabled channels

```typescript
import { getEnabledChannels } from "@/lib/channel-config";

const channels = getEnabledChannels(); // ['telegram', 'webchat']
```

### Get detailed channel config

```typescript
import { getChannelConfig } from "@/lib/channel-config";

const config = getChannelConfig("facebook");
console.log(config.enabled); // false (system level)
console.log(config.displayName); // 'Facebook Messenger'
console.log(config.notes); // 'Requires Meta App verification...'
```

### Require a channel or throw error

```typescript
import { requireChannelEnabled } from "@/lib/channel-config";

try {
  requireChannelEnabled("facebook", "Facebook integration context");
} catch (error) {
  // Handle error - channel is not enabled
}
```

## Dashboard Access

Users can manage their channel preferences here:
**Path:** `/dashboard/settings/channels`

Features:

- View all channels with status (Available / System Disabled)
- Toggle channels on/off (if available at system level)
- See descriptions of each channel
- Visual indicators for system vs tenant control

## Testing

### Test Facebook is disabled

```bash
# When ENABLE_CHANNEL_FACEBOOK=false

# 1. Check Facebook OAuth is not offered in login
curl http://localhost:3000/auth/login

# 2. Check webhook returns 403
curl -X POST http://localhost:3000/api/facebook/webhook \
  -H "Content-Type: application/json"
# Should return: 403 { error: "Facebook channel is not enabled" }

# 3. Check API returns 403
curl http://localhost:3000/api/facebook/pages \
  -H "Authorization: Bearer token"
# Should return: 403 { error: "Facebook channel is not enabled" }

# 4. Check tenant channels API
curl http://localhost:3000/api/tenant/channels \
  -H "Authorization: Bearer token"
# Should show: systemLevel.facebook = false
```

### Test Facebook is enabled

```bash
# When ENABLE_CHANNEL_FACEBOOK=true

# 1. Facebook OAuth should be offered
# 2. Webhook should process messages
# 3. API routes should work
# 4. Dashboard should show Facebook as available
```

## Environment Variables Reference

### Facebook Channel (when enabled)

```bash
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_verify_token
```

### Channel Control

```bash
# System-level: Set these to control what channels exist
ENABLE_CHANNEL_FACEBOOK=false    # Currently disabled
ENABLE_CHANNEL_TELEGRAM=true
ENABLE_CHANNEL_WEBCHAT=true
ENABLE_CHANNEL_WHATSAPP=false
```

## Migration from Old System

**Before:** Facebook code was tightly integrated, hard to disable
**After:** Facebook (and other channels) are modular and easy to toggle

Nothing needs to be migrated from users' perspective:

- Existing Facebook connections continue to work if channel is enabled
- When disabled, they become inaccessible but not deleted
- When re-enabled, they work again

## Monitoring

### Check current system channel status

```bash
# Review log output for channel initialization
grep "Channel status" logs/app.log

# Check environment variables are set
env | grep ENABLE_CHANNEL

# Query database for tenant channel status
SELECT * FROM tenant_channel_statuses;
```

### Common Issues & Solutions

**Issue:** Facebook button not showing on login page

- **Solution:** Check `ENABLE_CHANNEL_FACEBOOK` is not `false`, or this is expected behavior

**Issue:** Facebook routes return 403

- **Solution:** This is expected when `ENABLE_CHANNEL_FACEBOOK=false`

**Issue:** Can't toggle Facebook in dashboard even if enabled

- **Solution:** Check `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` are configured

**Issue:** Tenant channel status isn't persisting

- **Solution:** Check `TenantChannelStatus` table exists and migration was applied

## Modular Design Flexibility

The system is designed to be fully modular. You can:

1. **Change system-level channels** → Environment variables
2. **Control per-tenant channels** → Dashboard UI
3. **Add new channels** → Update config module, add database fields
4. **Remove channels completely** → Set env var to false or delete code

All changes are non-destructive - no data is lost when channels are disabled.

## Next Steps

1. **Verify Facebook is disabled:**
   - Confirm `ENABLE_CHANNEL_FACEBOOK=false` is set
   - Restart app and verify Facebook OAuth is not offered

2. **Test manual channel toggling:**
   - Go to Settings → Channel Management
   - Try toggling Telegram or WebChat on/off
   - Verify changes are saved

3. **When Meta verification is complete:**
   - Set `ENABLE_CHANNEL_FACEBOOK=true`
   - Restart app
   - Facebook features will be available system-wide

4. **Monitor usage:**
   - Check dashboard for which channels tenants are using
   - Plan future channel additions

---

For detailed documentation, see: `doc/CHANNEL_MANAGEMENT_SYSTEM.md`
