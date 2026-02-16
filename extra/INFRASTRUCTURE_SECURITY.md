# Phase 1: Infrastructure-Level Security Configuration

## 🎯 Objective

Configure reverse proxy (Nginx/Traefik/Coolify) to enforce access control at the infrastructure level, ensuring Typebot Engine and Viewer are never directly accessible without proper authentication.

## 🔒 Required Reverse Proxy Rules

### For Typebot Engine (`engine.replybase.co.uk`)

**CRITICAL**: All requests to the Engine MUST be blocked unless:

1. Request originates from `app.replybase.co.uk` (SaaS app), OR
2. Request includes valid `Authorization: Bearer <token>` header with OIDC token

#### Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name engine.replybase.co.uk;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Block all direct browser access
    # Only allow requests with Authorization header or from SaaS app
    location / {
        # Check for Authorization header (OIDC token)
        set $allow_access 0;

        # Allow if Authorization header is present
        if ($http_authorization) {
            set $allow_access 1;
        }

        # Allow if Referer is from SaaS app (for OIDC redirects)
        if ($http_referer ~* "^https://app\.replybase\.co\.uk") {
            set $allow_access 1;
        }

        # Allow if Origin is from SaaS app
        if ($http_origin ~* "^https://app\.replybase\.co\.uk") {
            set $allow_access 1;
        }

        # Block if no valid access
        if ($allow_access = 0) {
            return 403 "Direct access to Typebot Engine is not allowed. Please access through app.replybase.co.uk";
        }

        # Proxy to Typebot Engine
        proxy_pass http://typebot-engine:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Pass Authorization header
        proxy_set_header Authorization $http_authorization;
    }

    # Allow OIDC callback endpoint (Typebot will handle token validation)
    location /api/auth/oauth/generic-oidc/callback {
        proxy_pass http://typebot-engine:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Traefik Configuration Example

```yaml
http:
  routers:
    typebot-engine:
      rule: "Host(`engine.replybase.co.uk`)"
      entryPoints:
        - websecure
      middlewares:
        - typebot-engine-auth
        - typebot-engine-headers
      service: typebot-engine
      tls:
        certResolver: letsencrypt

  middlewares:
    typebot-engine-auth:
      # Custom middleware to check Authorization header or Referer
      # This requires a custom plugin or use of forwardAuth
      forwardAuth:
        address: "https://app.replybase.co.uk/api/infrastructure/validate-engine-access"
        authResponseHeaders:
          - Authorization
        trustForwardHeader: true

    typebot-engine-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"

  services:
    typebot-engine:
      loadBalancer:
        servers:
          - url: "http://typebot-engine:3000"
```

#### Coolify Configuration

In Coolify, configure the reverse proxy with:

1. **Custom Nginx Configuration**:

   - Add the Nginx rules above as custom configuration
   - Ensure SSL is enabled

2. **Environment Variables**:

   ```env
   TYPEBOT_OIDC_ISSUER=https://app.replybase.co.uk/api/oidc
   TYPEBOT_OIDC_CLIENT_ID=typebot-engine
   TYPEBOT_OIDC_CLIENT_SECRET=<secret>
   TYPEBOT_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback
   ```

3. **Access Control**:
   - Set "Public" to `false` in Coolify settings
   - Configure firewall rules to only allow traffic from `app.replybase.co.uk`

### For Typebot Viewer (`bot.replybase.co.uk`)

The Viewer should be more permissive but still restricted:

```nginx
server {
    listen 443 ssl http2;
    server_name bot.replybase.co.uk;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Block admin/builder routes
    location ~ ^/(builder|settings|analytics|admin|api/bots|api/workspaces) {
        return 403 "Admin routes are not accessible on the viewer domain";
    }

    # Allow public bot viewing (render-only)
    location / {
        proxy_pass http://typebot-viewer:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔐 Validation Endpoint (Optional)

Create a validation endpoint in the SaaS app to verify Engine access:

```typescript
// app/api/infrastructure/validate-engine-access/route.ts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const referer = req.headers.get("referer");

  // Check if request is from SaaS app
  if (referer?.includes("app.replybase.co.uk")) {
    return NextResponse.json({ allowed: true });
  }

  // Check if Authorization header is present (Typebot will validate token)
  if (authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ allowed: true });
  }

  return NextResponse.json({ allowed: false }, { status: 403 });
}
```

## ✅ Verification Checklist

After implementing infrastructure rules, verify:

- [ ] Direct access to `https://engine.replybase.co.uk` returns 403
- [ ] Access via SaaS app (`/api/typebot/authorize`) works correctly
- [ ] OIDC callback endpoint (`/api/auth/oauth/generic-oidc/callback`) is accessible
- [ ] Viewer domain blocks admin routes
- [ ] SSL certificates are valid
- [ ] Headers are properly forwarded

## 🚨 Security Notes

1. **Never expose Engine URLs** in frontend code or logs
2. **Use HTTPS only** for all domains
3. **Monitor access logs** for unauthorized access attempts
4. **Rotate OIDC secrets** regularly
5. **Keep reverse proxy updated** with security patches

## 📝 Typebot Engine Configuration

The Typebot Engine itself must be configured to:

1. **Disable public auth providers**:

   - Google OAuth: `DISABLE_GOOGLE_AUTH=true`
   - Facebook OAuth: `DISABLE_FACEBOOK_AUTH=true`
   - Email/Password: `DISABLE_EMAIL_AUTH=true`

2. **Enable OIDC**:

   ```env
   OIDC_ISSUER=https://app.replybase.co.uk/api/oidc
   OIDC_CLIENT_ID=typebot-engine
   OIDC_CLIENT_SECRET=<secret>
   OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback
   ```

3. **Validate tokens**:

   - Check `subscription_status === 'active'`
   - Verify token signature using JWKS from SaaS app
   - Reject requests without valid tokens (return 401/403)

4. **Block public routes**:
   - `/auth/*` should return 404 or redirect to SaaS
   - `/signin`, `/signup` should be disabled

## 🔄 Testing

Test the complete flow:

1. User logs into SaaS app
2. User clicks "Launch Builder"
3. SaaS generates OIDC authorization URL
4. User is redirected to Engine with OIDC flow
5. Engine validates token and grants access
6. Direct access to Engine without token returns 403
