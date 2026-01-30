# Onboarding System - Implementation Guide

## Getting Started

### 1. Database Setup

The onboarding system requires new Prisma models. These are already added to `prisma/schema.prisma`:

```bash
# Apply migrations
npm run prisma-dev

# This creates:
# - onboarding_sessions table
# - demo_templates table
# - onboarding_metrics table
```

### 2. Seed Demo Templates

Create `scripts/seed-demo-templates.ts`:

```typescript
import { prisma } from "@/lib/prisma";

async function seedDemoTemplates() {
  const templates = [
    {
      name: "ecommerce_product_catalog",
      displayName: "Product Catalog",
      description: "Browse and inquire about products",
      businessType: "ecommerce",
      icon: "🛍️",
      category: "engagement",
      flowJson: {
        /* Typebot flow structure */
      },
    },
    {
      name: "service_appointment_booking",
      displayName: "Appointment Booking",
      description: "Schedule appointments and services",
      businessType: "service",
      icon: "📅",
      category: "conversion",
      flowJson: {
        /* Typebot flow structure */
      },
    },
    // ... more templates
  ];

  for (const template of templates) {
    await prisma.demoTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }
}

seedDemoTemplates().then(() => {
  console.log("Demo templates seeded");
  process.exit(0);
});
```

Run with: `npx ts-node scripts/seed-demo-templates.ts`

### 3. Integrate with Facebook Webhook

In `app/api/facebook/webhook/route.ts`:

```typescript
import { OnboardingFlowHandler } from "@/lib/onboarding-flow-handler";

export async function POST(request: Request) {
  const { entry } = await request.json();

  for (const item of entry) {
    for (const event of item.messaging) {
      const { sender, message, postback } = event;

      if (message?.text || postback?.payload) {
        const messageText = message?.text || postback?.payload;

        // Check if this is an onboarding conversation
        const isOnboarding = await checkIfOnboarding(sender.id);

        if (isOnboarding) {
          await OnboardingFlowHandler.handleMessage(
            item.id, // pageId
            sender.id, // senderId
            messageText,
            conversation.id, // conversationId
            contact.id, // contactId
            pageAccessToken,
          );
        }
      }
    }
  }

  return new Response("ok");
}
```

### 4. Create Dashboard Pages

#### Analytics Dashboard

**Location**: `app/(dashboard)/onboarding/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function OnboardingAnalytics() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetch("/api/admin/onboarding/metrics")
      .then(r => r.json())
      .then(setMetrics);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Onboarding Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.completionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.averageTimeToComplete}m</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Abandoned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.abandonedSessions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Abandonment by stage chart */}
      {/* Plan selection distribution chart */}
    </div>
  );
}
```

#### Demo Templates Management

**Location**: `app/(dashboard)/onboarding/templates/page.tsx`

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";

export default function DemoTemplatesPage() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    fetch("/api/admin/demo-templates")
      .then(r => r.json())
      .then(setTemplates);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Demo Templates</h1>
        <Button>Add Template</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <Card key={template.id}>
            <CardContent className="pt-6">
              <div className="text-3xl mb-2">{template.icon}</div>
              <h3 className="font-semibold">{template.displayName}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>
              <p className="text-xs mt-2 text-muted-foreground">
                {template.businessType}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 5. Create API Routes

#### Get Onboarding Session

**Location**: `app/api/onboarding/[sessionId]/route.ts`

```typescript
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await prisma.onboardingSession.findUnique({
    where: { id: params.sessionId },
    include: {
      contact: true,
      facebookPage: true,
      plan: true,
    },
  });

  return new Response(JSON.stringify(session), {
    headers: { "Content-Type": "application/json" },
  });
}
```

#### Complete Onboarding

**Location**: `app/api/onboarding/[sessionId]/complete/route.ts`

```typescript
import { OnboardingService } from "@/lib/onboarding-service";

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await OnboardingService.completeOnboarding(params.sessionId);

  return new Response(JSON.stringify({ success: true, session }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

#### Get Metrics

**Location**: `app/api/admin/onboarding/metrics/route.ts`

```typescript
import { getServerSession } from "next-auth";
import { OnboardingService } from "@/lib/onboarding-service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenant: true },
  });

  const metrics = await OnboardingService.getMetrics(user.tenantId);

  return new Response(JSON.stringify(metrics), {
    headers: { "Content-Type": "application/json" },
  });
}
```

### 6. Environment Variables

Add to `.env.local`:

```bash
# Facebook Messenger
FACEBOOK_API_URL=https://graph.facebook.com/v19.0
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_PAGE_TOKEN=your_token

# Onboarding
ONBOARDING_COMPLETION_URL=https://yourdomain.com/dashboard
TRIAL_DURATION_DAYS=14
```

### 7. Email Templates

Create email templates for:

1. **Onboarding Confirmation** - Welcome + credentials
2. **Demo Template Activated** - Quick start guide
3. **Trial Ending Soon** - Upgrade reminder
4. **Account Created** - Next steps

Use SendGrid, Resend, or your email provider.

## Testing the Flow

### Manual Testing

1. **Message Facebook Page**

   ```
   Visit: facebook.com/replybase
   Send: Any message
   Bot should reply with welcome + Get Started button
   ```

2. **Walk Through Stages**
   - Click each button
   - Verify data saves in database
   - Check messages flow naturally

3. **Test Abandonment**
   - Start but don't complete
   - Verify session marked abandoned
   - Check metrics updated

### Automated Tests

```typescript
// tests/onboarding.test.ts
import { OnboardingService } from "@/lib/onboarding-service";
import { prisma } from "@/lib/prisma";

describe("Onboarding Flow", () => {
  it("should create session on start", async () => {
    const session = await OnboardingService.getOrCreateSession(
      "page_id",
      "conversation_id",
      "contact_id",
    );

    expect(session.stage).toBe("WELCOME");
    expect(session.status).toBe("IN_PROGRESS");
  });

  it("should progress through stages", async () => {
    const session = await OnboardingService.getOrCreateSession(
      "page_id",
      "conversation_id",
      "contact_id",
    );

    await OnboardingService.progressStage(session.id, "COLLECT_INFO");
    const updated = await prisma.onboardingSession.findUnique({
      where: { id: session.id },
    });

    expect(updated.stage).toBe("COLLECT_INFO");
  });

  it("should save contact information", async () => {
    const session = await OnboardingService.getOrCreateSession(
      "page_id",
      "conversation_id",
      "contact_id",
    );

    await OnboardingService.updateSessionInfo(session.id, {
      contactName: "John Doe",
      email: "john@example.com",
      businessType: "ecommerce",
    });

    const updated = await prisma.onboardingSession.findUnique({
      where: { id: session.id },
    });

    expect(updated.contactName).toBe("John Doe");
    expect(updated.businessType).toBe("ecommerce");
  });

  it("should complete onboarding", async () => {
    const session = await OnboardingService.getOrCreateSession(
      "page_id",
      "conversation_id",
      "contact_id",
    );

    const completed = await OnboardingService.completeOnboarding(session.id);

    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).toBeDefined();
    expect(completed.tenantId).toBeDefined();
  });
});
```

Run tests with: `npm test`

## Monitoring & Analytics

### Key Metrics to Track

```typescript
// Log metrics
analytics.track("onboarding_started", {
  pageId,
  businessType,
  timestamp,
});

analytics.track("onboarding_stage_completed", {
  stage,
  durationSeconds,
  timestamp,
});

analytics.track("onboarding_abandoned", {
  stage,
  durationSeconds,
  timestamp,
});

analytics.track("onboarding_completed", {
  planSelected,
  trialOrPaid,
  durationSeconds,
  timestamp,
});
```

### Dashboards

1. **Real-time Dashboard**
   - Current sessions
   - Current stage distribution
   - Recent completions

2. **Historical Analytics**
   - Completion rate over time
   - Average time to complete
   - Abandonment by stage
   - Plan distribution trends

3. **User Experience**
   - Common drop-off points
   - Message sent/received times
   - Error frequencies

## Troubleshooting

### Common Issues

**Issue**: Onboarding session not creating

```
→ Check FB webhook is registered
→ Verify page access token is valid
→ Check database migrations applied
```

**Issue**: Messages not sending

```
→ Verify FACEBOOK_API_URL is correct
→ Check pageAccessToken is still valid
→ Check FB API rate limits
```

**Issue**: Data not saving

```
→ Verify Prisma client generated
→ Check database connection
→ Review schema for missing fields
```

## Optimization Tips

1. **Message Timing**
   - Add small delays between bot messages (500-1000ms)
   - Makes interaction feel more natural

2. **Retry Logic**
   - Implement exponential backoff for API calls
   - Graceful failure handling

3. **Caching**
   - Cache demo templates
   - Cache plan pricing
   - Invalidate on updates

4. **Performance**
   - Batch database queries
   - Use indexes on frequently queried fields
   - Monitor query performance

## Next Steps

1. ✅ Database migration completed
2. ⏳ Integrate with Facebook webhook
3. ⏳ Create onboarding pages
4. ⏳ Set up email templates
5. ⏳ Deploy and test live
6. ⏳ Monitor metrics
7. ⏳ Optimize based on data

---

**Ready to go live**: Feb 14, 2026
