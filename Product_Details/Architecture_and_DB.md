# Technical Architecture & Database Setup: ReplyBase

## 1. System Architecture: The "Communication Orchestra"
The ReplyBase architecture is designed for multi-tenant isolation and highly flexible channel integration.
- **Framework:** Next.js 16 (App Router) for both the frontend dashboard and API routes.
- **Language:** TypeScript for end-to-end type safety.
- **Bot Engine Integration:**
  - **Optional Brain:** Typebot (external integration) via OIDC-based authentication.
  - **Internal Brain:** Flow Builder (internal logic) using Prisma-backed node and session management.
- **Real-time Webhooks:** Centralized webhook handlers for Facebook, Telegram, and Stripe to synchronize external events with the internal database.

### Simplified Flow
```
Customer (Web, Telegram, TikTok) → Channel Webhook → ReplyBase Orchestra (AI Converse / Flow Engine) → Unified Inbox Dashboard
```

## 2. Database Setup (Prisma & PostgreSQL)
The database is structured to support a multi-tenant SaaS model, where every resource belongs to a `Tenant`.

### Key Models
- **Tenant:** The top-level entity representing a business. Owns all users, bots, and contacts.
- **User:** Individual team members belonging to a Tenant. Managed via NextAuth with custom `tenantId` session extensions.
- **Subscription:** Links a Tenant to a `Plan` and tracks Stripe customer IDs and billing status.
- **Bot:** Represents an AI-powered or rule-based entity that can be connected to multiple channels.
- **Channel:** Defines how a Bot interacts with the outside world (Type: `web`, `facebook`, `telegram`, `whatsapp`, etc.).
- **CrmConversation & CrmMessage:** Stores the unified communication history, regardless of the source channel.
- **Contact:** Centralizes customer details (name, email, phone) and links multiple `ContactIdentity` records (Telegram ID, Webchat Visitor ID) to a single person.
- **Flow & FlowNode:** Power the internal "Brain" for automated engagement.

### Multi-Tenancy Enforcement
Every query to the database for business-sensitive data is scoped by `tenantId` using the `withAuthAndTenant` higher-order helper, ensuring complete isolation between clients.

## 3. QA & Testing Setup
Quality is maintained through a combination of automated and manual checks:
- **Unit & Integration Testing:** Vitest is used for testing core business logic like AI engine interaction and subscription limits.
- **End-to-End (E2E) Testing:** Playwright is configured for browser-based testing of the onboarding flow, dashboard navigation, and webchat widget functionality.
- **Diagnostic Scripts:** A suite of custom scripts (e.g., `scripts/diagnose-facebook-integration.ts`) for real-time verification of production integrations.
- **System Health Monitoring:** The `SystemHealth` model and related API routes provide real-time status updates for external dependencies like Typebot and Stripe.

## 4. Deployment & Infrastructure
- **Containerization:** Dockerized application for consistent environments.
- **CI/CD:** Automated builds with Prisma runtime verification and fallback logic to prevent production build failures.
- **Security:** HSTS headers, XSS protection, and OIDC-based key rotation are standard for all deployments.
