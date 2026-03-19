# Engine Access Restriction Guide

## Issue

`engine.replybase.co.uk` (bot-builder) and `bot.replybase.co.uk` (bot-viewer) are publicly accessible. These should be restricted to:

- Internal SaaS application only
- OR specific IP addresses/networks

## Current Status

```bash
# Public access test
curl -I https://engine.replybase.co.uk
curl -I https://bot.replybase.co.uk
# Returns: HTTP 200 (direct access)
```

## Recommended Solutions

### Option A: Custom Nginx Access Rules (Recommended for App-Only Access)

Use Coolify's Custom Nginx rules to block direct access while still allowing
the OIDC flow and app-launched access.

#### Engine (engine.replybase.co.uk)

In Coolify -> Engine -> Advanced -> Custom Nginx:

```nginx
set $allow_access 0;
if ($http_authorization) { set $allow_access 1; }
if ($http_referer ~* "^https://app\.replybase\.co\.uk") { set $allow_access 1; }
if ($allow_access = 0) { return 403 "Direct access forbidden. Use app.replybase.co.uk"; }

location = /api/auth/callback/generic-oidc {
  # Allow without restrictions
}
```

#### Viewer (bot.replybase.co.uk)

In Coolify -> Viewer -> Advanced -> Custom Nginx:

```nginx
if ($http_referer !~* "^https://app\.replybase\.co\.uk") {
  return 403 "Direct access forbidden. Use app.replybase.co.uk";
}

location ~ ^/(builder|settings|analytics|admin|api/bots|api/workspaces|api/users) {
  return 403 "Admin routes not accessible on viewer domain";
}
```

**Result**:

- Direct access to engine/viewer returns 403
- Access launched from the SaaS app works

---

### Option B: IP Whitelist via Traefik

Restrict access to the engine and viewer domains using Traefik middleware.

#### Step 1: Create IP Whitelist Middleware

Edit the bot-builder docker-compose.yaml:

```bash
cd /data/coolify/applications/zsw4wccwc0s88s4o0osck4k8
nano docker-compose.yaml
```

#### Step 2: Add Traefik Labels

**Find the labels section and add:**

```yaml
labels:
  # ... existing labels ...

  # IP Whitelist Middleware
  - "traefik.http.middlewares.engine-ipwhitelist.ipwhitelist.sourcerange=YOUR_OFFICE_IP/32,YOUR_VPN_CIDR"

  # Apply middleware to HTTPS router
  - "traefik.http.routers.https-0-{service_id}.middlewares=engine-ipwhitelist,gzip"
```

**Example with specific IPs:**

```yaml
labels:
  # Existing labels
  - traefik.enable=true
  - traefik.http.routers.https-0-zsw4wccwc0s88s4o0osck4k8.entryPoints=https
  - traefik.http.routers.https-0-zsw4wccwc0s88s4o0osck4k8.rule=Host(`engine.replybase.co.uk`)
  - traefik.http.routers.https-0-zsw4wccwc0s88s4o0osck4k8.tls=true
  - traefik.http.routers.https-0-zsw4wccwc0s88s4o0osck4k8.service=https-0-zsw4wccwc0s88s4o0osck4k8

  # NEW: IP Whitelist
  - "traefik.http.middlewares.engine-ipwhitelist.ipwhitelist.sourcerange=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,YOUR_OFFICE_IP/32"

  # MODIFIED: Add ipwhitelist to middlewares
  - "traefik.http.routers.https-0-zsw4wccwc0s88s4o0osck4k8.middlewares=engine-ipwhitelist,gzip"
```

#### Step 3: Get Your Current IP

```bash
# Find your current public IP
curl -s ifconfig.me
# Example output: 203.0.113.45

# Use /32 for single IP, /24 for subnet
# Format: 203.0.113.45/32
```

#### Step 4: Apply Changes

```bash
cd /data/coolify/applications/zsw4wccwc0s88s4o0osck4k8
docker compose up -d --force-recreate

# Verify Traefik picked up changes
docker logs coolify-proxy 2>&1 | grep -i "engine.replybase.co.uk" | tail -5

# Repeat for bot-viewer (bot.replybase.co.uk)
cd /data/coolify/applications/<bot-viewer-app-id>
docker compose up -d --force-recreate

docker logs coolify-proxy 2>&1 | grep -i "bot.replybase.co.uk" | tail -5
```

#### Step 5: Test Access

```bash
# From allowed IP (should work)
curl -I https://engine.replybase.co.uk
# Expected: HTTP 200

curl -I https://bot.replybase.co.uk
# Expected: HTTP 200

# From disallowed IP (should block)
curl -I https://engine.replybase.co.uk --interface {different_ip}
# Expected: HTTP 403 Forbidden

curl -I https://bot.replybase.co.uk --interface {different_ip}
# Expected: HTTP 403 Forbidden
```

---

### Option C: Private Network Only (Most Secure)

Make the engine and viewer only accessible from within the Docker network (internal SaaS app access only).

#### Step 1: Remove Public Exposure

Edit docker-compose.yaml:

```yaml
services:
  { container_name }:
    # Remove expose section or change to internal network only
    networks:
      coolify:
        internal: true # Add this
```

#### Step 2: Update Traefik Labels

Remove or disable external routing:

```yaml
labels:
  - traefik.enable=false # Disable external routing
  # OR keep internal routing only by removing public domain labels
```

#### Step 3: Update SaaS App Configuration

The SaaS app should connect via Docker network:

```bash
# In SaaS .env file
TYPEBOT_ENGINE_URL=http://zsw4wccwc0s88s4o0osck4k8-225113629810:3000
# Instead of: https://engine.replybase.co.uk
```

**Note**: This breaks OIDC callback since the engine needs to be accessible to the user's browser for the OAuth flow.
To use private-only access, add a browser-accessible proxy path through the SaaS app.

---

### Option C: UFW Firewall Rules (Alternative)

Use Ubuntu's firewall to restrict access.

#### Step 1: Check Current UFW Status

```bash
ufw status verbose
```

#### Step 2: Add Rate Limiting for Engine

```bash
# Allow your office IP
ufw allow from YOUR_OFFICE_IP to any port 443 comment 'Engine access - Office'

# Allow Stripe webhook IPs (if needed)
ufw allow from 3.18.12.0/23 to any port 443 comment 'Stripe webhooks'
ufw allow from 3.130.192.0/25 to any port 443 comment 'Stripe webhooks'

# Default deny for all other IPs would be too broad (affects all services)
# UFW is NOT service-specific, so this option is NOT recommended
```

**Note**: UFW operates at the server level, not per-domain. This is NOT ideal for this use case.

---

## Recommended Approach

**Use Option A: Custom Nginx Access Rules**

### Whitelist Configuration Example

```yaml
# Allow these IP ranges:
sourcerange: |
  10.0.0.0/8,          # Private network (if using VPN)
  172.16.0.0/12,       # Private network
  192.168.0.0/16,      # Private network
  YOUR_OFFICE_IP/32,   # Your office public IP
  YOUR_HOME_IP/32      # Your home IP (if working remotely)
```

### Dynamic IP Considerations

If your IP changes frequently:

1. **Use a VPN** with static IP
2. **Use Cloudflare Access** (requires Cloudflare as proxy)
3. **Use BasicAuth** as additional layer:

```yaml
labels:
  # Create basicauth middleware
  - "traefik.http.middlewares.engine-auth.basicauth.users=admin:$$apr1$$H6uskkkW$$IgXLP6ewTrSuBkTrqE8wj/"

  # Apply both middlewares
  - "traefik.http.routers.https-0-{service_id}.middlewares=engine-auth,engine-ipwhitelist,gzip"
```

Generate basicauth hash:

```bash
htpasswd -nb admin your_password
# Output: admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/
# Use double $$ in docker-compose.yaml
```

---

## Verification

After implementing restrictions:

```bash
# 1. Test direct access (should fail)
curl -I https://engine.replybase.co.uk
curl -I https://bot.replybase.co.uk
# Expected: HTTP 403

# 2. Test from random IP (use proxy service like https://www.ipchicken.com/)
# Expected: HTTP 403 Forbidden

# 3. Test OIDC flow still works
# - Login to https://app.replybase.co.uk
# - Navigate to /bots
# - Click "Open Bot Builder"
# - Should redirect successfully via OIDC
```

## Important OIDC Consideration

**The engine MUST be accessible to the user's browser** for the OIDC callback flow to work:

```
User Browser → SaaS (/api/typebot/authorize) → Redirects to Engine
User Browser → Engine (login via OIDC) → Callback to SaaS
User Browser → Engine (authenticated session)
```

### Solution for OIDC + IP Restriction

1. **Use Custom Nginx rules** (recommended) to block direct access but allow app flow
2. **OR Use Cloudflare Access** for identity-aware proxy
3. **OR Use IP allowlist** for internal-only access

The current setup (public engine + OIDC auth) is **acceptable** if:

- OIDC is properly configured ✓
- Only SaaS users can authenticate ✓
- Engine has no public signup page (controlled by `DISABLE_EMAIL_AUTH=true`) ✓

---

## Rollback

If IP whitelist causes issues:

```bash
cd /data/coolify/applications/zsw4wccwc0s88s4o0osck4k8

# Remove IP whitelist label from docker-compose.yaml
# Remove the middleware from the router

docker compose up -d --force-recreate
```

## Monitoring

Check Traefik logs for blocked requests:

```bash
docker logs coolify-proxy 2>&1 | grep -i "403\|forbidden" | grep "engine.replybase.co.uk"
```
