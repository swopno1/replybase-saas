# Typebot Engine Configuration for Phase 1

## 🎯 Objective

Configure Typebot Engine (`engine.replybase.co.uk`) to function as a private backend service, fully controlled by the SaaS application. The Engine must reject all requests without valid OIDC tokens from the SaaS app.

## 🔒 Required Configuration

### 1. Disable All Public Authentication

**CRITICAL**: Typebot Engine must NOT allow users to authenticate directly.

#### Disable Google OAuth

```env
DISABLE_GOOGLE_AUTH=true
# Or in Typebot settings UI: Disable Google provider
```

#### Disable Facebook OAuth

```env
DISABLE_FACEBOOK_AUTH=true
# Or in Typebot settings UI: Disable Facebook provider
```

#### Disable Email/Password Login

```env
DISABLE_EMAIL_AUTH=true
# Or in Typebot settings UI: Disable Email/Password provider
```

#### Remove/Block Public Auth Routes

- `/auth/*` → Return 404 or redirect to SaaS app
- `/signin` → Return 404 or redirect to SaaS app
- `/signup` → Return 404 or redirect to SaaS app

**Implementation**: Add middleware to block these routes:

```typescript
// Example middleware (Typebot-specific implementation may vary)
if (
  req.path.startsWith("/auth/") ||
  req.path === "/signin" ||
  req.path === "/signup"
) {
  return res.redirect("https://app.replybase.co.uk");
}
```

### 2. Enable OIDC Provider

Configure Typebot to use OIDC as the ONLY authentication method.

#### Environment Variables

```env
# OIDC Provider Configuration
OIDC_ISSUER=https://app.replybase.co.uk/api/oidc
OIDC_CLIENT_ID=typebot-engine
OIDC_CLIENT_SECRET=<same-secret-as-saas-app>
OIDC_CALLBACK_URL=https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback

# OIDC Scopes (if configurable)
OIDC_SCOPE=openid email profile plan subscription_status
```

#### Typebot UI Configuration

1. Go to Typebot Settings → Authentication
2. Enable "Generic OIDC" provider
3. Enter:
   - Issuer: `https://app.replybase.co.uk/api/oidc`
   - Client ID: `typebot-engine`
   - Client Secret: `<secret>`
   - Callback URL: `https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback`
   - Scopes: `openid email profile plan subscription_status`

### 3. Implement Hard Access Gate (Token Validation)

**REQUIREMENT**: All requests to Typebot Engine MUST be validated.

#### Token Validation Middleware

Create middleware that validates OIDC tokens on ALL routes:

```typescript
// Example implementation (adapt to Typebot's architecture)
import { verifyJWT } from "jose";
import { createRemoteJWKSet } from "jose";

const JWKS_URL = "https://app.replybase.co.uk/api/oidc/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

async function validateToken(
  req: Request
): Promise<{ valid: boolean; claims?: any }> {
  // Get token from Authorization header or session
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || req.session?.accessToken;

  if (!token) {
    return { valid: false };
  }

  try {
    // Verify token signature
    const { payload } = await verifyJWT(token, JWKS, {
      issuer: "https://app.replybase.co.uk/api/oidc",
      audience: "typebot-engine",
    });

    // CRITICAL: Check subscription status
    if (payload.subscription_status !== "active") {
      console.warn(
        `[Access Denied] User ${payload.sub} has inactive subscription`
      );
      return { valid: false };
    }

    // Verify required claims
    if (!payload.sub || !payload.email) {
      return { valid: false };
    }

    return { valid: true, claims: payload };
  } catch (error) {
    console.error("[Token Validation] Error:", error);
    return { valid: false };
  }
}

// Apply to all routes
export async function accessGateMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Allow OIDC callback endpoint (it will validate after callback)
  if (req.path === "/api/auth/oauth/generic-oidc/callback") {
    return next();
  }

  const validation = await validateToken(req);

  if (!validation.valid) {
    return res.status(401).json({
      error: "Unauthorized",
      message:
        "Valid OIDC token required. Please access through app.replybase.co.uk",
    });
  }

  // Attach claims to request for use in routes
  req.user = validation.claims;
  next();
}
```

#### Apply to Routes

Apply the middleware to:

- **UI Routes**: `/`, `/builder/*`, `/settings/*`, `/analytics/*`
- **API Routes**: `/api/bots/*`, `/api/workspaces/*`, `/api/users/*`
- **WebSocket/Polling**: Any real-time endpoints

**Exception**: Public bot viewing routes (if any) should be handled separately.

### 4. Viewer Configuration (`bot.replybase.co.uk`)

The Viewer must be render-only with no admin functionality.

#### Block Admin Routes

```typescript
// Block these routes on Viewer domain
const BLOCKED_ROUTES = [
  "/builder",
  "/settings",
  "/analytics",
  "/admin",
  "/api/bots",
  "/api/workspaces",
  "/api/users",
];

if (BLOCKED_ROUTES.some((route) => req.path.startsWith(route))) {
  return res.status(403).json({
    error: "Forbidden",
    message: "Admin routes are not accessible on the viewer domain",
  });
}
```

#### Allow Only Public Bot Viewing

- `/` → Public bot list/search (if needed)
- `/:botId` → Public bot viewer
- `/api/v1/typebots/:publicId/startChat` → Public chat API

## 🔍 Token Claims Validation

The Engine MUST validate these claims in the OIDC token:

```json
{
  "sub": "user_id", // Required: User ID
  "email": "user@email.com", // Required: User email
  "plan": "starter | pro | enterprise", // Required: Subscription plan
  "subscription_status": "active", // CRITICAL: Must be "active"
  "iss": "https://app.replybase.co.uk/api/oidc", // Required: Issuer
  "aud": "typebot-engine" // Required: Audience
}
```

### Validation Rules

1. **Token Signature**: Verify using JWKS from `https://app.replybase.co.uk/api/oidc/.well-known/jwks.json`
2. **Issuer**: Must match `https://app.replybase.co.uk/api/oidc`
3. **Audience**: Must match `typebot-engine`
4. **Subscription Status**: Must be `"active"` (strict check)
5. **Expiration**: Token must not be expired
6. **Required Claims**: `sub`, `email`, `plan`, `subscription_status` must be present

### Error Responses

- **401 Unauthorized**: Missing or invalid token
- **403 Forbidden**: Valid token but `subscription_status !== 'active'`

## 🧪 Testing

### Test Cases

1. **Direct Access Without Token**

   ```bash
   curl https://engine.replybase.co.uk
   # Expected: 401 Unauthorized
   ```

2. **Access With Invalid Token**

   ```bash
   curl https://engine.replybase.co.uk \
     -H "Authorization: Bearer invalid-token"
   # Expected: 401 Unauthorized
   ```

3. **Access With Expired Token**

   ```bash
   curl https://engine.replybase.co.uk \
     -H "Authorization: Bearer <expired-token>"
   # Expected: 401 Unauthorized
   ```

4. **Access With Inactive Subscription**

   ```bash
   # Token with subscription_status: "cancelled"
   curl https://engine.replybase.co.uk \
     -H "Authorization: Bearer <token-with-inactive-sub>"
   # Expected: 403 Forbidden
   ```

5. **Valid OIDC Flow**

   - User clicks "Launch Builder" in SaaS
   - Redirected to OIDC authorization
   - Callback receives code
   - Token exchange succeeds
   - User can access builder
   - **Expected**: Success, user sees builder UI

6. **Public Auth Routes Blocked**
   ```bash
   curl https://engine.replybase.co.uk/auth/google
   curl https://engine.replybase.co.uk/signin
   curl https://engine.replybase.co.uk/signup
   # Expected: 404 or redirect to SaaS app
   ```

## 📋 Implementation Checklist

- [ ] Disable Google OAuth provider
- [ ] Disable Facebook OAuth provider
- [ ] Disable Email/Password authentication
- [ ] Block `/auth/*` routes
- [ ] Block `/signin` and `/signup` routes
- [ ] Configure OIDC provider settings
- [ ] Implement token validation middleware
- [ ] Apply middleware to all protected routes
- [ ] Validate `subscription_status === 'active'`
- [ ] Verify token signature using JWKS
- [ ] Verify issuer and audience claims
- [ ] Configure Viewer domain to block admin routes
- [ ] Test all access scenarios
- [ ] Monitor access logs for unauthorized attempts

## 🔐 Security Notes

1. **Never Trust Client-Side**: All validation must happen server-side
2. **Token Storage**: Store tokens securely (httpOnly cookies preferred)
3. **Token Refresh**: Implement refresh token flow for long sessions
4. **Rate Limiting**: Add rate limiting to prevent brute force
5. **Logging**: Log all access attempts (success and failure)
6. **Monitoring**: Alert on repeated 401/403 responses
7. **Key Rotation**: Plan for JWKS key rotation

## 🐛 Troubleshooting

### Issue: Token validation fails

**Check:**

- JWKS endpoint is accessible
- Clock skew is accounted for (allow ±5 minutes)
- Token format is correct (Bearer token)
- Claims match expected structure

### Issue: Users can still access without tokens

**Check:**

- Middleware is applied to all routes
- No bypass routes exist
- Session handling doesn't allow unauthenticated access
- Public routes are properly isolated

### Issue: OIDC callback fails

**Check:**

- Callback URL matches configuration
- Client secret is correct
- Scopes are requested correctly
- Redirect URI is whitelisted

## 📚 Typebot-Specific Notes

Typebot may have specific configuration methods. Consult Typebot documentation for:

- OIDC provider configuration UI
- Middleware/hook system
- Route protection mechanisms
- Session management
- Token storage

Adapt the examples above to Typebot's specific architecture and APIs.
