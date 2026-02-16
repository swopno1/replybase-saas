# Quick Start: API Key Authentication Setup

This guide helps you set up secure API communication between your marketing site and SaaS application.

## Step 1: Generate API Secret Key

On your server or terminal, generate a secure 32-character key:

```bash
openssl rand -hex 32
```

Example output:

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

## Step 2: Add to SaaS Application

In your **SaaS app** (`replybase-saas`), add to `.env`:

```bash
API_SECRET_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

Restart your application:

```bash
npm run dev
# or for production
pm2 restart replybase-saas
```

## Step 3: Add to Marketing Site

In your **marketing site** (https://replybase.co.uk/), add to `.env.local`:

```bash
REPLYBASE_API_URL=https://app.replybase.co.uk
REPLYBASE_API_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

## Step 4: Test Integration

Test with cURL:

```bash
curl -X POST https://app.replybase.co.uk/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET_KEY" \
  -d '{"email":"test@example.com"}'
```

Expected response:

```json
{
  "success": true,
  "email": "test@example.com",
  "unsubscribeUrl": "https://app.replybase.co.uk/newsletter/unsubscribe?token=...",
  "source": "api-key"
}
```

## Security Checklist

- [ ] API key is at least 32 characters long
- [ ] Same key is set on both SaaS and marketing site
- [ ] Key is stored in environment variables (never in code)
- [ ] Key is NOT committed to version control
- [ ] HTTPS is enforced on both domains
- [ ] CORS headers are configured for marketing domain

## Troubleshooting

**401 Unauthorized:**

- Verify API key matches on both sides
- Check header format: `Authorization: Bearer YOUR_KEY`
- Ensure environment variable is loaded

**CORS Error:**

- Add marketing domain to CORS config in `next.config.ts`

**500 Server Error:**

- Check if `API_SECRET_KEY` is set in SaaS `.env`
- Verify database connection
- Check server logs for details

## Next Steps

1. Review [MARKETING_SITE_API_INTEGRATION.md](./MARKETING_SITE_API_INTEGRATION.md) for complete API documentation
2. Review [AGENT_INSTRUCTIONS_MARKETING_SITE.md](./AGENT_INSTRUCTIONS_MARKETING_SITE.md) for implementation steps
3. Implement newsletter forms on marketing site
4. Test all endpoints thoroughly
5. Deploy to production

## Support

For assistance, refer to the main documentation files or contact the development team.
