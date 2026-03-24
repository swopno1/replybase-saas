# Marketing Site API Integration Guide

## Overview

This document provides instructions for integrating the ReplyBase SaaS APIs into the marketing site at **https://replybase.co.uk/**. These APIs enable newsletter subscription management and data deletion requests from your marketing site.

## Authentication

All API requests from the marketing site must include an API secret key for authentication.

### Environment Variable Setup

On the **SaaS application** (`replybase-saas`), add the following to your `.env` file:

```bash
# Generate a secure random key using: openssl rand -hex 32
API_SECRET_KEY=your_secure_secret_key_here
```

**Important:** Keep this key secure and never commit it to version control.

### Marketing Site Configuration

On your **marketing site** (https://replybase.co.uk/), store the same API secret key:

```bash
# .env.local or environment variables
REPLYBASE_API_SECRET=your_secure_secret_key_here
REPLYBASE_API_URL=https://app.replybase.co.uk
```

---

## Available APIs

### 1. Newsletter Subscription

Subscribe users to your newsletter.

**Endpoint:** `POST /api/newsletter/subscribe`

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_SECRET_KEY"
}
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter",
  "email": "user@example.com",
  "unsubscribeUrl": "https://app.replybase.co.uk/newsletter/unsubscribe?token=abc123...",
  "source": "api-key"
}
```

**Error Responses:**

- `400` - Invalid email address
- `401` - Missing or invalid API key
- `500` - Server error

---

### 2. Newsletter Unsubscription

Unsubscribe users from the newsletter.

**Endpoint:** `POST /api/newsletter/unsubscribe`

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_SECRET_KEY"
}
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Successfully unsubscribed from newsletter",
  "email": "user@example.com",
  "source": "api-key"
}
```

**Error Responses:**

- `400` - Email required
- `401` - Missing or invalid API key
- `404` - Email not found in newsletter list
- `500` - Server error

---

### 3. Data Deletion Request

Submit a GDPR data deletion request.

**Endpoint:** `POST /api/data-deletion/request`

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_SECRET_KEY"
}
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Data deletion request submitted successfully",
  "email": "user@example.com",
  "confirmationCode": "DEL-1234567890",
  "statusUrl": "https://app.replybase.co.uk/data-deletion-status?code=DEL-1234567890",
  "source": "api-key"
}
```

**Error Responses:**

- `400` - Invalid email address
- `401` - Missing or invalid API key
- `500` - Server error

---

### 4. Data Deletion Status (Public - No Auth Required)

Check the status of a data deletion request.

**Endpoint:** `GET /api/data-deletion/status?code=CONFIRMATION_CODE`

**Headers:** None required (public endpoint)

**Query Parameters:**

- `code` - The confirmation code from the deletion request

**Success Response (200):**

```json
{
  "success": true,
  "request": {
    "email": "user@example.com",
    "status": "PENDING",
    "requestedAt": "2026-01-30T10:30:00.000Z",
    "processedAt": null
  }
}
```

**Deletion Status Values:**

- `PENDING` - Request received, awaiting processing
- `IN_PROGRESS` - Currently being processed
- `COMPLETED` - Data successfully deleted
- `REJECTED` - Request rejected (with reason)

---

## Implementation Examples

### Next.js App Router (React Server Components)

```typescript
// app/actions/newsletter.ts
"use server";

export async function subscribeToNewsletter(email: string) {
  const response = await fetch(
    `${process.env.REPLYBASE_API_URL}/api/newsletter/subscribe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REPLYBASE_API_SECRET}`,
      },
      body: JSON.stringify({ email }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to subscribe");
  }

  return response.json();
}

export async function unsubscribeFromNewsletter(email: string) {
  const response = await fetch(
    `${process.env.REPLYBASE_API_URL}/api/newsletter/unsubscribe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REPLYBASE_API_SECRET}`,
      },
      body: JSON.stringify({ email }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to unsubscribe");
  }

  return response.json();
}

export async function requestDataDeletion(email: string) {
  const response = await fetch(
    `${process.env.REPLYBASE_API_URL}/api/data-deletion/request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REPLYBASE_API_SECRET}`,
      },
      body: JSON.stringify({ email }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to submit deletion request");
  }

  return response.json();
}
```

### Next.js Client Component Example

```typescript
// components/NewsletterForm.tsx
'use client';

import { useState } from 'react';
import { subscribeToNewsletter } from '@/app/actions/newsletter';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await subscribeToNewsletter(email);
      setMessage('✓ Successfully subscribed to newsletter!');
      setEmail('');
    } catch (error) {
      setMessage(`✗ ${error instanceof Error ? error.message : 'Failed to subscribe'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="flex-1 px-4 py-2 border rounded"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Subscribing...' : 'Subscribe'}
      </button>
      {message && <p className="text-sm mt-2">{message}</p>}
    </form>
  );
}
```

### Vanilla JavaScript/Node.js Example

```javascript
// Server-side (Node.js backend)
const REPLYBASE_API_URL = process.env.REPLYBASE_API_URL;
const REPLYBASE_API_SECRET = process.env.REPLYBASE_API_SECRET;

async function subscribeToNewsletter(email) {
  const response = await fetch(
    `${REPLYBASE_API_URL}/api/newsletter/subscribe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${REPLYBASE_API_SECRET}`,
      },
      body: JSON.stringify({ email }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to subscribe");
  }

  return response.json();
}

// Usage
try {
  const result = await subscribeToNewsletter("user@example.com");
  console.log("Subscribed:", result);
} catch (error) {
  console.error("Error:", error.message);
}
```

### Alternative API Key Header

Instead of `Authorization: Bearer`, you can also use the `x-api-key` header:

```typescript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': process.env.REPLYBASE_API_SECRET,
}
```

---

## Security Best Practices

### 1. Never Expose API Key on Client Side

❌ **WRONG** - Don't do this:

```javascript
// This exposes your API key in the browser!
fetch("https://app.replybase.co.uk/api/newsletter/subscribe", {
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_KEY}`, // ❌ Exposed!
  },
});
```

✅ **CORRECT** - Use server actions or API routes:

```typescript
// Server action (runs on server, key stays private)
"use server";
export async function subscribe(email: string) {
  return fetch("...", {
    headers: {
      Authorization: `Bearer ${process.env.REPLYBASE_API_SECRET}`, // ✓ Secure
    },
  });
}
```

### 2. Validate Email on Both Sides

Always validate emails on both marketing site and SaaS API.

### 3. Rate Limiting

Consider implementing rate limiting on your marketing site to prevent abuse:

```typescript
// Example with upstash/ratelimit
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 m"), // 10 requests per 10 minutes
});

export async function subscribeToNewsletter(email: string) {
  const { success } = await ratelimit.limit(email);
  if (!success) {
    throw new Error("Too many requests. Please try again later.");
  }

  // Proceed with API call...
}
```

### 4. CORS Configuration

The SaaS API should accept requests from your marketing domain. Update `next.config.ts`:

```typescript
// next.config.ts (on SaaS app)
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/newsletter/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://replybase.co.uk",
          },
          { key: "Access-Control-Allow-Methods", value: "POST, GET, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, x-api-key",
          },
        ],
      },
      {
        source: "/api/data-deletion/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://replybase.co.uk",
          },
          { key: "Access-Control-Allow-Methods", value: "POST, GET, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, x-api-key",
          },
        ],
      },
    ];
  },
};
```

---

## Testing

### Testing with cURL

```bash
# Subscribe to newsletter
curl -X POST https://app.replybase.co.uk/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_secret_key" \
  -d '{"email":"test@example.com"}'

# Unsubscribe
curl -X POST https://app.replybase.co.uk/api/newsletter/unsubscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_secret_key" \
  -d '{"email":"test@example.com"}'

# Request data deletion
curl -X POST https://app.replybase.co.uk/api/data-deletion/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_secret_key" \
  -d '{"email":"test@example.com"}'

# Check deletion status (no auth required)
curl https://app.replybase.co.uk/api/data-deletion/status?code=DEL-1234567890
```

### Testing with Postman

1. Create a new request in Postman
2. Set method to `POST`
3. Set URL: `https://app.replybase.co.uk/api/newsletter/subscribe`
4. Add headers:
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer YOUR_API_SECRET_KEY`
5. Set body (raw JSON):
   ```json
   {
     "email": "test@example.com"
   }
   ```
6. Send request and verify response

---

## Error Handling

Always implement proper error handling:

```typescript
async function handleNewsletterSubscription(email: string) {
  try {
    const result = await subscribeToNewsletter(email);

    // Success
    return {
      success: true,
      message: "Successfully subscribed!",
      data: result,
    };
  } catch (error) {
    // Handle different error types
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.error("API authentication failed");
        return {
          success: false,
          message: "Configuration error. Please contact support.",
        };
      }

      if (error.message.includes("400")) {
        return {
          success: false,
          message: "Invalid email address. Please check and try again.",
        };
      }
    }

    // Generic error
    return {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    };
  }
}
```

---

## Monitoring & Logging

### On Marketing Site

Log API calls for debugging (without exposing sensitive data):

```typescript
export async function subscribeToNewsletter(email: string) {
  console.log(
    "[Newsletter] Subscribing:",
    email.replace(/(.{2}).*(@.*)/, "$1***$2"),
  );

  try {
    const result = await fetch(/* ... */);
    console.log("[Newsletter] Success");
    return result.json();
  } catch (error) {
    console.error(
      "[Newsletter] Error:",
      error instanceof Error ? error.message : "Unknown",
    );
    throw error;
  }
}
```

### On SaaS Application

Monitor API usage in server logs. The API responses include a `source` field indicating whether the request came from API key or user session.

---

## Support & Troubleshooting

### Common Issues

**401 Unauthorized:**

- Verify API secret key matches on both sides
- Check Authorization header format: `Bearer YOUR_KEY`
- Ensure environment variable is loaded correctly

**CORS Errors:**

- Add marketing domain to CORS configuration
- Verify request is coming from server-side, not browser

**500 Server Error:**

- Check SaaS application logs
- Verify database connection
- Ensure Prisma models are migrated

**Email Already Subscribed:**

- API will upsert (update existing subscription)
- Check subscriber status in database

### Contact

For technical support with API integration, contact the development team or refer to the main ReplyBase documentation.

---

## Deployment Checklist

Before going live with marketing site integration:

- [ ] Generate secure API secret key (min 32 characters)
- [ ] Add `API_SECRET_KEY` to SaaS `.env` file
- [ ] Add `REPLYBASE_API_SECRET` to marketing site environment
- [ ] Configure CORS headers on SaaS app
- [ ] Test all API endpoints with production URL
- [ ] Implement rate limiting on marketing site
- [ ] Set up error logging and monitoring
- [ ] Test newsletter subscription flow end-to-end
- [ ] Test data deletion request flow
- [ ] Verify unsubscribe links work correctly
- [ ] Test with invalid/malformed requests
- [ ] Document any custom modifications

---

**Last Updated:** January 30, 2026  
**API Version:** 1.0  
**SaaS Application:** https://app.replybase.co.uk  
**Marketing Site:** https://replybase.co.uk
