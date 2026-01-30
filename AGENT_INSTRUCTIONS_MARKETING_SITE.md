# Agent Instructions: Marketing Site API Integration

## Context

You are implementing newsletter subscription and data deletion features on the ReplyBase marketing site (https://replybase.co.uk/). The marketing site needs to communicate with the SaaS application's APIs (https://app.replybase.co.uk) using secure API key authentication.

---

## Your Tasks

### 1. Environment Setup

Create or update the `.env.local` file in the marketing site project:

```bash
REPLYBASE_API_URL=https://app.replybase.co.uk
REPLYBASE_API_SECRET=<OBTAIN_FROM_SAAS_TEAM>
```

**Note:** The `REPLYBASE_API_SECRET` must match the `API_SECRET_KEY` set on the SaaS application.

---

### 2. Create Server Actions File

Create `app/actions/replybase-api.ts` (or `lib/api/replybase.ts` depending on project structure):

```typescript
"use server";

const API_URL = process.env.REPLYBASE_API_URL;
const API_SECRET = process.env.REPLYBASE_API_SECRET;

if (!API_URL || !API_SECRET) {
  throw new Error(
    "REPLYBASE_API_URL and REPLYBASE_API_SECRET must be configured",
  );
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Subscribe an email to the ReplyBase newsletter
 */
export async function subscribeToNewsletter(
  email: string,
): Promise<ApiResponse<{ email: string; unsubscribeUrl: string }>> {
  try {
    const response = await fetch(`${API_URL}/api/newsletter/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_SECRET}`,
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to subscribe to newsletter",
      };
    }

    return {
      success: true,
      message: data.message,
      data: {
        email: data.email,
        unsubscribeUrl: data.unsubscribeUrl,
      },
    };
  } catch (error) {
    console.error("[Newsletter Subscribe] Error:", error);
    return {
      success: false,
      error: "Network error. Please try again later.",
    };
  }
}

/**
 * Unsubscribe an email from the ReplyBase newsletter
 */
export async function unsubscribeFromNewsletter(
  email: string,
): Promise<ApiResponse<{ email: string }>> {
  try {
    const response = await fetch(`${API_URL}/api/newsletter/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_SECRET}`,
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to unsubscribe",
      };
    }

    return {
      success: true,
      message: data.message,
      data: { email: data.email },
    };
  } catch (error) {
    console.error("[Newsletter Unsubscribe] Error:", error);
    return {
      success: false,
      error: "Network error. Please try again later.",
    };
  }
}

/**
 * Submit a data deletion request (GDPR)
 */
export async function requestDataDeletion(
  email: string,
): Promise<ApiResponse<{ confirmationCode: string; statusUrl: string }>> {
  try {
    const response = await fetch(`${API_URL}/api/data-deletion/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_SECRET}`,
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to submit deletion request",
      };
    }

    return {
      success: true,
      message: data.message,
      data: {
        confirmationCode: data.confirmationCode,
        statusUrl: data.statusUrl,
      },
    };
  } catch (error) {
    console.error("[Data Deletion] Error:", error);
    return {
      success: false,
      error: "Network error. Please try again later.",
    };
  }
}
```

---

### 3. Create Newsletter Subscription Component

Create `components/NewsletterForm.tsx`:

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { subscribeToNewsletter } from '@/app/actions/replybase-api';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await subscribeToNewsletter(email);

    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Successfully subscribed!' });
      setEmail(''); // Clear form on success
    } else {
      setMessage({ type: 'error', text: result.error || 'Something went wrong' });
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Subscribing...' : 'Subscribe'}
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}
      </form>

      <p className="text-xs text-gray-500 mt-2">
        We respect your privacy. Unsubscribe at any time.
      </p>
    </div>
  );
}
```

---

### 4. Create Data Deletion Request Component

Create `components/DataDeletionForm.tsx`:

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { requestDataDeletion } from '@/app/actions/replybase-api';

export function DataDeletionForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
    statusUrl?: string;
    confirmationCode?: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const response = await requestDataDeletion(email);

    if (response.success && response.data) {
      setResult({
        type: 'success',
        message: 'Your data deletion request has been submitted successfully.',
        statusUrl: response.data.statusUrl,
        confirmationCode: response.data.confirmationCode,
      });
      setEmail('');
    } else {
      setResult({
        type: 'error',
        message: response.error || 'Failed to submit request. Please try again.',
      });
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Submitting Request...' : 'Request Data Deletion'}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            result.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <p
            className={`font-medium ${
              result.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {result.message}
          </p>

          {result.confirmationCode && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">
                <strong>Confirmation Code:</strong> {result.confirmationCode}
              </p>
              {result.statusUrl && (
                <a
                  href={result.statusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:underline"
                >
                  Check Status →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        By submitting this form, you are requesting the deletion of all your personal data
        associated with this email address in accordance with GDPR.
      </p>
    </div>
  );
}
```

---

### 5. Usage in Pages

#### Newsletter Section (e.g., Footer or Homepage)

```tsx
// app/page.tsx or components/Footer.tsx
import { NewsletterForm } from "@/components/NewsletterForm";

export default function HomePage() {
  return (
    <div>
      {/* ... other content ... */}

      <section className="bg-gray-100 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
          <p className="text-gray-600 mb-8">
            Get the latest updates, tips, and insights delivered to your inbox.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}
```

#### Privacy/GDPR Page

```tsx
// app/privacy/page.tsx
import { DataDeletionForm } from "@/components/DataDeletionForm";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      {/* ... privacy policy content ... */}

      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">Request Data Deletion</h2>
        <p className="text-gray-600 mb-6">
          In accordance with GDPR, you have the right to request deletion of
          your personal data. Submit your request below.
        </p>
        <DataDeletionForm />
      </section>
    </div>
  );
}
```

---

### 6. Optional: Rate Limiting (Recommended)

Install rate limiting library:

```bash
npm install @upstash/ratelimit @upstash/redis
```

Update server actions with rate limiting:

```typescript
"use server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 requests per 10 minutes per email
});

export async function subscribeToNewsletter(email: string) {
  // Rate limit check
  const { success: rateLimitPassed } = await ratelimit.limit(
    `newsletter:${email}`,
  );

  if (!rateLimitPassed) {
    return {
      success: false,
      error: "Too many requests. Please try again in 10 minutes.",
    };
  }

  // Proceed with API call...
  // ... existing code ...
}
```

---

### 7. Testing Checklist

Test the following scenarios:

- [ ] Valid email subscription works
- [ ] Invalid email shows error
- [ ] Double subscription (same email twice)
- [ ] Unsubscribe functionality
- [ ] Data deletion request submission
- [ ] Network error handling (disconnect internet)
- [ ] API key validation (test with wrong key)
- [ ] Form validation (empty email, malformed email)
- [ ] Loading states display correctly
- [ ] Success/error messages are user-friendly
- [ ] CORS works (if applicable)

---

### 8. Deployment Steps

1. **Set environment variables in deployment platform** (Vercel, Netlify, etc.):
   - `REPLYBASE_API_URL=https://app.replybase.co.uk`
   - `REPLYBASE_API_SECRET=<secret_key>`

2. **Verify environment variables are loaded**:

   ```bash
   # In your build logs, you should NOT see this error:
   # "REPLYBASE_API_URL and REPLYBASE_API_SECRET must be configured"
   ```

3. **Test on staging environment** before production

4. **Monitor API calls** in production for errors

---

### 9. Error Monitoring (Optional but Recommended)

Add error tracking to catch issues:

```typescript
// app/actions/replybase-api.ts
import * as Sentry from "@sentry/nextjs"; // or your error tracking tool

export async function subscribeToNewsletter(email: string) {
  try {
    // ... API call ...
  } catch (error) {
    Sentry.captureException(error, {
      tags: { action: "newsletter-subscribe" },
      extra: { email: email.replace(/(.{2}).*(@.*)/, "$1***$2") }, // Redact email
    });

    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}
```

---

## Summary

You will create:

1. **Server actions file** (`app/actions/replybase-api.ts`) - API communication logic
2. **NewsletterForm component** - UI for newsletter subscription
3. **DataDeletionForm component** - UI for GDPR data deletion requests
4. **Environment variables** - API URL and secret key configuration
5. **Integration in pages** - Use components in footer, privacy page, etc.

**Key Security Points:**

- ✅ API secret is only in server-side code (never in client)
- ✅ All API calls go through server actions
- ✅ Rate limiting prevents abuse
- ✅ Proper error handling for user experience

**API Endpoints You'll Use:**

- `POST /api/newsletter/subscribe` - Subscribe to newsletter
- `POST /api/newsletter/unsubscribe` - Unsubscribe from newsletter
- `POST /api/data-deletion/request` - Request data deletion

Refer to `MARKETING_SITE_API_INTEGRATION.md` for complete API documentation and testing instructions.

---

**Questions or Issues?**

If you encounter errors:

1. Check environment variables are set correctly
2. Verify API secret matches between sites
3. Test API directly with cURL first
4. Check browser console and server logs
5. Verify CORS configuration on SaaS app

Good luck with the implementation! 🚀
