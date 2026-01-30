# Client Onboarding System - Complete Design

**Status**: Production-Ready  
**Date**: January 30, 2026  
**Target**: Feb 14 Launch

## Overview

A comprehensive, multi-channel onboarding system that guides new clients from their first Facebook message through account setup and first demo. The system is elegant, trustworthy, and user-friendly.

## Onboarding Flow

### Stage 1: Welcome & Engagement

**Channel**: Facebook Messenger  
**Duration**: 30 seconds

```
Client sends message to ReplyBase FB page
         ↓
Bot shows welcome message with "Get Started" button
         ↓
Client clicks "Get Started"
         ↓
Session created in database
```

**Message**:

```
🎉 Welcome to ReplyBase!

We're excited to help you automate your customer conversations
on Facebook Messenger. Let's get you set up in just a few minutes!

[Get Started Button]
```

### Stage 2: Information Collection

**Duration**: 2-3 minutes

#### Step 2a: Name Collection

```
Bot: "Great! Let's start with the basics. What's your name?"
Client: [Types name]
Result: contactName saved
```

#### Step 2b: Business Type Selection

```
Bot: "Perfect! Now, what type of business are you in?"

Quick Replies:
• 🛍️ E-commerce
• 💼 Service
• 🚀 SaaS
• 🤝 Agency
• 📊 Other

Client: [Selects one]
Result: businessType saved → determines demo templates later
```

#### Step 2c: Contact Information

```
Bot: "Could you share your business email and phone number?"
Client: "contact@mybusiness.com, +1 (555) 123-4567"
Result: email & phone parsed and saved
```

#### Step 2d: Email Preferences

```
Bot: "How often would you like to receive updates from us?"

Quick Replies:
• 📅 Daily
• 📆 Weekly
• 📋 Monthly
• 🔕 Never

Client: [Selects frequency]
Result: emailFrequency saved
```

### Stage 3: Package Selection

**Duration**: 1-2 minutes

```
Bot displays 3 pricing cards:

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Starter         │  │ Professional ★  │  │ Enterprise      │
│ $29/month       │  │ $79/month       │  │ Custom Price    │
│ • 100 daily msgs│  │ • 500 daily msgs│  │ • Unlimited     │
│ • 1 bot         │  │ • 3 bots        │  │ • Unlimited     │
│ • Basic ana.    │  │ • Advanced ana. │  │ • Priority sup. │
│ [Select]        │  │ [Select]        │  │ [Contact Sales] │
└─────────────────┘  └─────────────────┘  └─────────────────┘

Client: [Clicks Select on Professional]
Result: selectedPlanId saved
```

**Features by Plan**:

- **Starter**: Perfect for testing, small businesses
- **Professional**: For growing teams, better analytics
- **Enterprise**: Full customization, dedicated support

### Stage 4: Payment or Trial Decision

**Duration**: 1 minute

```
Bot: "Great choice! 🎯 Would you like to start with a free trial
or proceed directly to payment?"

Quick Replies:
• 🎁 Start Free Trial (14 days, no CC required)
• 💳 Go to Payment (Start immediately)

Client chooses: [Trial or Payment]
Result: paymentOption saved
```

**If Trial Selected** → Goes to Stage 5  
**If Payment Selected** → Redirects to Stripe checkout

### Stage 5: Demo Template Selection

**Duration**: 2-3 minutes  
**Only if Trial Selected**

```
Bot: "Perfect! Let's select a demo template that matches your
business type. This will give you a head start with pre-built
conversation flows."

Business Type: E-commerce
┌──────────────────────────┐
│ 🛍️ Product Catalog      │
│ Browse products & prices │
│ [Select]                 │
└──────────────────────────┘

┌──────────────────────────┐
│ 🏷️ Lead Generation       │
│ Collect customer info    │
│ [Select]                 │
└──────────────────────────┘

┌──────────────────────────┐
│ 📞 Customer Support      │
│ FAQ automation           │
│ [Select]                 │
└──────────────────────────┘

┌──────────────────────────┐
│ 📅 Appointment Booking   │
│ Schedule & calendar      │
│ [Select]                 │
└──────────────────────────┘

Client: [Selects "Product Catalog"]
Result: demoFlowSelected saved
```

**Demo Templates by Business Type**:

| Business Type | Available Templates                      |
| ------------- | ---------------------------------------- |
| E-commerce    | Product Catalog, Lead Gen, Order Updates |
| Service       | Appointment Booking, Lead Gen, Support   |
| SaaS          | Trial Signup, Feature Demo, Support      |
| Agency        | Project Inquiry, Services, Portfolio     |
| Other         | Generic Lead Gen, Contact Form           |

### Stage 6: Confirmation & Dashboard Redirect

**Duration**: 1 minute

```
Bot: "🎉 You're all set! Your ReplyBase account is ready.

Here's what comes next:
1. You'll receive a confirmation email with your login details
2. Open your dashboard to customize your bot
3. Our team will reach out soon to support your launch

Let's get you to your dashboard!"

[Open Dashboard Button]

Client: [Clicks Open Dashboard]
Result: onboarding completed, tenant created, redirected to dashboard
```

**Behind the Scenes**:

- Tenant account created
- Subscription initialized
- Contact linked to tenant
- Automated welcome email sent
- Dashboard access granted
- Demo flow loaded (if trial)

## Database Models

### OnboardingSession

```prisma
model OnboardingSession {
  id                String                    @id @default(cuid())
  tenantId          String?                   // Created after payment
  facebookPageId    String                    // Which page initiated
  conversationId    String                    // Facebook conversation
  contactId         String                    // Customer contact
  stage             OnboardingStage           // Current stage
  status            OnboardingStatus          // Progress status

  // Collected Data
  contactName       String?
  businessName      String?
  businessType      String?                   // For demo selection
  phone             String?
  email             String?
  emailFrequency    EmailFrequency?

  // Selections
  selectedPlanId    String?
  demoFlowSelected  String?

  // Timeline
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt
  completedAt       DateTime?

  @@index([status, stage])
}
```

### DemoTemplate

```prisma
model DemoTemplate {
  id                String                    @id @default(cuid())
  name              String                    // Unique identifier
  displayName       String                    // UI display name
  description       String?
  businessType      String                    // "ecommerce", "service", etc
  flowJson          Json                      // Typebot flow structure
  icon              String?                   // UI icon/emoji
  category          String?                   // "engagement", "lead_gen", etc
  enabled           Boolean                   @default(true)
  order             Int                       @default(0)
  createdAt         DateTime                  @default(now())

  @@index([businessType, enabled])
}
```

### OnboardingMetrics

```prisma
model OnboardingMetrics {
  id                String                    @id @default(cuid())
  tenantId          String
  totalSessions     Int
  completedSessions Int
  abandonedAt       Json?                     // { "COLLECT_INFO": 5, "PACKAGE_SELECTION": 3 }
  averageTimeToComplete Int?
  planSelectionDistribution Json?
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt

  @@unique([tenantId])
}
```

## Enums

```typescript
enum OnboardingStage {
  WELCOME
  COLLECT_INFO
  BUSINESS_TYPE
  CONTACT_INFO
  EMAIL_PREFERENCE
  PACKAGE_SELECTION
  PAYMENT_OR_TRIAL
  DEMO_SELECTION
  CONFIRMATION
  COMPLETED
}

enum OnboardingStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
  FAILED
}

enum EmailFrequency {
  DAILY
  WEEKLY
  MONTHLY
  NEVER
}
```

## Core Services

### OnboardingService

**Location**: `lib/onboarding-service.ts`

Key methods:

- `getOrCreateSession()` - Initialize or retrieve session
- `getStageMessage()` - Get message for each stage
- `updateSessionInfo()` - Store collected data
- `progressStage()` - Move to next stage
- `completeOnboarding()` - Mark complete + create account
- `createTenantFromOnboarding()` - Set up new tenant
- `abandonSession()` - Track abandonment
- `getMetrics()` - Analytics dashboard data

### OnboardingFlowHandler

**Location**: `lib/onboarding-flow-handler.ts`

Key methods:

- `handleMessage()` - Process incoming FB messages
- `parseMessageAction()` - Understand intent from text/payloads
- `processMessageContent()` - Extract and store information
- `sendMessage()` - Format and send FB messages
- `getDashboardRedirectUrl()` - Generate redirect link

## Facebook Messenger Integration

### Quick Replies vs Text Messages

```javascript
// Quick Reply (user sees buttons)
{
  text: "What type of business?",
  quick_replies: [
    { title: "E-commerce", payload: "business_ecommerce" },
    { title: "Service", payload: "business_service" }
  ]
}

// Generic Cards (larger display)
{
  attachment: {
    type: "template",
    payload: {
      template_type: "generic",
      elements: [
        {
          title: "Starter Plan",
          subtitle: "$29/month",
          buttons: [{ title: "Select", payload: "plan_starter" }]
        }
      ]
    }
  }
}
```

## User Experience Features

### 1. Progress Clarity

- ✅ Show current step (2 of 10)
- ✅ Display progress bar
- ✅ Numbered step indicators
- ✅ Clear "Next" buttons

### 2. Reassurance

- ✅ "No credit card required" for trial
- ✅ "Cancel anytime" messaging
- ✅ Professional tone throughout
- ✅ Response times < 1 second

### 3. Mobile Optimization

- ✅ Full-screen friendly
- ✅ Touch-friendly buttons (48px minimum)
- ✅ Optimized for Facebook mobile app
- ✅ Clear hierarchy and spacing

### 4. Error Handling

```typescript
// Invalid email format
Bot: "That doesn't look like a valid email.
     Could you please try again?"

// Timeout handling
Bot: "Are you still there? Let me send you back
     to the main menu..."

// Payment errors
Bot: "There was an issue with payment.
     Our team will reach out shortly."
```

## Conversion Optimization

### Abandonment Prevention

- Track where users drop off
- Auto-recovery for inactive sessions (5-min timeout)
- Offer help: "Having trouble? Chat with our team"
- Mobile-optimized layouts
- Clear value proposition at each step

### Default Values

```typescript
// Suggest business types based on FB page info
const suggestedType = inferBusinessTypeFromPageName(pageName);

// Pre-fill known information
const prefillEmail = getEmailFromFBProfile();
```

### Social Proof

```
"Join 5,000+ businesses automating with ReplyBase"
"30-day money-back guarantee"
"Used by top brands like [company names]"
```

## Email Integration

### Transactional Emails

1. **Onboarding Confirmation**
   - Welcome message
   - Login credentials
   - Dashboard link
   - Next steps

2. **Demo Template Assigned**
   - Template name
   - Quick start guide
   - Video tutorial link

3. **Trial Ending Soon**
   - Countdown (3, 1 days before)
   - Upgrade link
   - Support contact

4. **Account Created**
   - Activation confirmation
   - Setup checklist
   - Onboarding resources

### Email Frequency Respected

- User selected frequency stored
- Automated systems honor selection
- Unsubscribe always available

## Success Metrics

### Key KPIs

```typescript
// Conversion Rate
completionRate = completedSessions / totalSessions

// Time to Complete
averageTimeToComplete // Should be < 5 minutes

// Abandonment Rate
abandonmentRate = abandonedSessions / totalSessions

// Abandonment by Stage
abandonmentByStage = {
  WELCOME: 2%,
  COLLECT_INFO: 8%,
  PACKAGE_SELECTION: 15%,
  PAYMENT_OR_TRIAL: 20%
}

// Plan Selection Distribution
{
  starter: 30%,
  professional: 50%,
  enterprise: 20%
}
```

### Dashboard Analytics

- Total sessions initiated
- Completion rate over time
- Average time to complete
- Drop-off points
- Most selected plans
- Most selected demos
- Trial-to-paid conversion

## Security & Privacy

### Data Protection

- ✅ HTTPS for all communications
- ✅ PCI compliance for payments
- ✅ GDPR-compliant data handling
- ✅ Session encryption
- ✅ Automatic session cleanup after 30 days

### Fraud Prevention

- ✅ Rate limiting on message handlers
- ✅ Validate email format
- ✅ Check for duplicate accounts
- ✅ Monitor suspicious patterns

### Privacy

- ✅ Clear privacy policy link
- ✅ Explicit data usage consent
- ✅ Email frequency respect
- ✅ Right to delete data

## Implementation Checklist

### Backend

- [ ] Create Prisma migrations
- [ ] Implement OnboardingService
- [ ] Implement OnboardingFlowHandler
- [ ] Create demo templates
- [ ] Set up email templates
- [ ] Add webhookhandler integration
- [ ] Implement analytics tracking

### Frontend

- [ ] Create onboarding UI components
- [ ] Build admin dashboard for analytics
- [ ] Implement demo template management
- [ ] Create analytics dashboard
- [ ] Add abandonment recovery flows

### Integration

- [ ] FB webhook message handling
- [ ] Stripe payment integration
- [ ] Email service integration
- [ ] Tenant auto-creation
- [ ] Typebot flow deployment

### Testing

- [ ] End-to-end flow testing
- [ ] Mobile responsiveness
- [ ] Error scenario testing
- [ ] Payment flow testing
- [ ] Email delivery testing

### Deployment

- [ ] Environment variables
- [ ] Database migrations
- [ ] Demo template seeding
- [ ] Monitoring setup
- [ ] Analytics dashboards

## Future Enhancements

### Phase 2

- Video tutorials in onboarding
- Personalized demo recommendations (AI)
- Multi-language support
- Lead scoring based on signals
- A/B testing for messaging
- Chatbot handoff to human agent

### Phase 3

- In-app guided tours
- Contextual help system
- Integration templates (Zapier, etc)
- Advanced analytics
- Conversion funnel optimization

## Go-Live Checklist

Before Feb 14 launch:

- [ ] All database migrations applied
- [ ] OnboardingService tested
- [ ] FB message handling verified
- [ ] Email templates reviewed
- [ ] Demo templates configured
- [ ] Payment flow tested
- [ ] Analytics dashboard ready
- [ ] Team trained on system
- [ ] Monitoring alerts set
- [ ] Backup/recovery plan

---

**Status**: Ready for Implementation  
**Expected Launch**: Feb 14, 2026  
**Support Contact**: onboarding@replybase.com
