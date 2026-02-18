# Client Onboarding Status Report & Production Plan

## 1. Current Progress Report

The Replybase onboarding system is currently in its initial development phase. The following components have been implemented:

### Infrastructure
- **Database Models**: `OnboardingSession`, `DemoTemplate`, and `OnboardingMetrics` models are defined in the Prisma schema.
- **Enums**: `OnboardingStage` and `OnboardingStatus` are used to track progress and state.

### Core Logic
- **OnboardingService**: Manages session lifecycle, content delivery for each stage, and conversion of onboarding data into Tenants and Subscriptions.
- **OnboardingFlowHandler**: Handles the conversational logic for Facebook Messenger, parsing user inputs and routing to appropriate stages.
- **Webhook Integration**: The Facebook webhook (`app/api/facebook/webhook/route.ts`) correctly identifies new users and routes them to the onboarding flow.

### Admin Tools
- **Onboarding Dashboard**: A dedicated page at `/admin/onboarding` lists recent sessions and provides basic metrics.

---

## 2. Production-Grade Onboarding Plan

To move the onboarding process to production grade, the following improvements are planned and will be implemented:

### Phase 1: Robustness & Validation (Development)
- **Input Validation**: Implement regex-based validation for Email and Phone numbers within the conversational flow.
- **Error Handling**: Graceful handling of invalid inputs with helpful prompts for the user to try again.
- **Account Preparation**: Ensure the collected email is stored in a way that allows automatic linking when the user eventually creates a web account.

### Phase 2: Content & Templates
- **Template Integration**: Link the "Demo Selection" stage to real `DemoTemplate` data.
- **Initial Flow Creation**: Automatically provision a default conversation flow for the new tenant based on their industry selection during onboarding.
- **Carousel UI**: Use Facebook's Generic Template (Carousel) for plan selection to provide a more visual and professional experience.

### Phase 3: Admin & Analytics
- **Navigation Integration**: Add the Onboarding dashboard to the main admin navigation.
- **Drop-off Analysis**: Implement detailed abandonment tracking to identify where users are leaving the funnel. (Currently calculated dynamically from session data).
- **Executive Summary**: Add onboarding performance metrics to the main "Business Status" admin page.

### Phase 4: Verification
- **E2E Simulation**: Test the full flow from "Get Started" to "Dashboard Redirect" using simulated webhook events.
- **Data Integrity**: Verify that Tenants, Subscriptions, and initial Flows are correctly created and linked.
