# Project Feature List & Architecture Overview

This document provides a comprehensive overview of the ReplyBase platform, detailing its features, technical architecture, and core workflows. It also includes recommendations for the "New Version" rebranding and simplification.

---

## 1. Complete Features List

### Core Communication
- **Omnichannel Unified Inbox**: Centralized management for Webchat, Facebook Messenger, Telegram, and WhatsApp.
- **Real-time Messaging**: Low-latency message delivery and synchronization using WebSockets and efficient polling.
- **Rich Media Support**: Handling of text, images, and quick replies across all supported channels.
- **Internal Notes**: Ability for team members to leave private notes within conversation threads.

### Automation & AI
- **V6 Visual Flow Builder**: A node-based drag-and-drop interface for creating complex automation workflows.
- **AI Fallback Engine**: Intelligent, context-aware automated responses when a user query doesn't match any pre-defined flow.
- **Variable Interpolation**: Use of dynamic data (e.g., `{{name}}`, `{{email}}`) within automation nodes.
- **Sanitized Inputs**: Automatic cleaning of lead names and other variables to remove conversational filler.

### CRM & Lead Management
- **Lead Capture & Scoring**: Automatic identification and qualification of leads during conversations.
- **Contact Identity Stitching**: Linking users across different channels to maintain a single source of truth.
- **Lead Action Engine**: Triggering external webhooks or internal actions when specific milestones are reached.
- **Custom Tags**: Labeling contacts and leads for segmented marketing and sales tracking.

### Admin & Operations
- **SaaS Dashboard**: KPI tracking, usage metrics, and subscription management.
- **Simulation Lab**: A sandboxed environment for testing and debugging flows before deployment.
- **Multi-Tenant Management**: Secure workspace isolation for different organizations.
- **Audit Logging**: Comprehensive tracking of administrative actions for security and compliance.

---

## 2. Auth System and Auth Flow

### Authentication Framework
- **Provider**: [Auth.js (NextAuth.js)](https://next-auth.js.org/).
- **Strategies**: JWT (JSON Web Tokens) for session management.
- **Supported Methods**:
    - **Google OAuth**: Single Sign-On for easy access.
    - **Facebook OAuth**: Required for Messenger/WhatsApp integration management.
    - **Email/Password**: Traditional credentials with secure hashing (bcrypt).

### Auth Flow Scenario
1. **Login Request**: User selects a login method at `/auth/login`.
2. **Identity Verification**: The chosen provider (Google, FB, or Credentials) verifies the user's identity.
3. **Tenant Resolution**:
    - If it's a new user, a new `Tenant` and workspace are automatically created.
    - The `tenantId` is retrieved from the `User` record in the database.
4. **JWT Issuance**: A secure JWT is generated containing the user's `id`, `tenantId`, `role`, and `isAdmin` status.
5. **Session Hydration**: The JWT is passed to the client-side session, and the `tenantId` is used to scope all subsequent API calls via the `withAuthAndTenant` wrapper.

---

## 3. Bot, Flows, Channels, and Relationships

### Conceptual Hierarchy
- **Tenant (Workspace)**: The top-level entity representing a customer or organization.
- **Bot**: A logical automation container. (Note: To be simplified in New Version).
- **Channel**: A connection to a messaging platform (e.g., a specific Facebook Page, Telegram Bot, or Webchat site).
- **Flow**: The logic/automation script (JSON-based) associated with a Bot or Channel.

### Relationships
- A **Tenant** owns multiple **Bots**.
- A **Bot** can be linked to multiple **Channels** (e.g., one bot managing both Telegram and WhatsApp).
- A **Channel** has one active **FlowAssignment** that determines which **Flow** runs when a message is received.
- **Execution**: When a message hits a **Channel**, the system looks up the assigned **Flow** via the **Bot** and executes it.

---

## 4. Under-the-Hood Workflow (Complete Scenario)

### Example: A Customer messages via WhatsApp
1. **Ingress (Webhook)**: Meta sends a POST request to `/api/whatsapp/webhook`.
2. **Verification**: The system verifies the `X-Hub-Signature-256` to ensure authenticity.
3. **Queueing**: The raw message payload is pushed into **BullMQ** (`message-processing` queue) to ensure the API responds within the required 200ms window.
4. **Processing (Worker)**: The background worker picks up the job:
    - Identifies the **Tenant** and **Channel** based on the phone number.
    - Retrieves the active **Flow** for that channel.
5. **Flow Engine Execution**:
    - The engine checks for an existing **FlowSession**.
    - It executes the current node (e.g., "Send Welcome Message").
    - If an "Input" node is reached, it waits for the next user message.
6. **AI Fallback (If needed)**: If no matching node or trigger is found, the AI Engine (Llama 3.1) generates a response based on the bot's "Context" and conversation history.
7. **Egress (Outgoing Message)**: The response is sent back to the customer via the WhatsApp Business API.

---

## 5. Conversations, Contacts, and Leads

### Data Entities
- **Contact**: An individual person identified by a platform-specific ID (e.g., WhatsApp number, FB PSID).
- **Conversation**: The actual thread of messages between a Contact and the Bot/Agent.
- **Lead**: A "qualified" version of a Contact. When the system extracts a name, email, or intent, it creates a Lead record linked to the Contact.

### The Logic
1. **Identity Stitching**: If a user messages from Webchat and then provides their email, the system checks if a Contact with that email already exists from another channel (like WhatsApp) and merges them.
2. **Lead Enrichment**: While the conversation progresses, background AI processes analyze the text to update Lead status (e.g., `new` -> `qualified`).

---

## 6. Channel Implementations

- **Webchat**: Uses a lightweight JS snippet embedded on a website. Communicates via a dedicated `/api/webchat` endpoint. Supports bot-mitigation (honeypots) to prevent spam.
- **Facebook Messenger**: Connects via the Meta Graph API. Requires a Facebook Page to be linked. Uses webhooks for real-time delivery.
- **Telegram**: Uses the Telegram Bot API with a Bot Token provided by the user.
- **WhatsApp**: Supports multiple providers (Meta Cloud API, Twilio, 360dialog). Messages are handled asynchronously via BullMQ.

---

## 7. Flow Design (Orchestrator)

The **V6 Orchestrator** is a JSON-based state machine.
- **Nodes**: Message, Input, Condition (If/Else), Action (Tag, Webhook), Wait, Typing, End.
- **Triggers**: Keyword-based (e.g., "help", "pricing") or event-based (e.g., "New Conversation").
- **Variables**: State is preserved in `FlowSession.variables`. Users can use `{{variable_name}}` in any text node.

---

## 8. Tenant Isolation

### Prisma Client Extensions
The platform uses a "Default Deny" isolation strategy.
1. **Extension Logic**: A custom Prisma extension (`lib/prisma-tenant.ts`) intercepts every database query.
2. **Automatic Filtering**: If a model has a `tenantId` field, the extension automatically injects `where: { tenantId: "current-tenant-id" }`.
3. **Developer Safety**: This prevents developers from accidentally leaking data across tenants, as they don't have to remember to add the filter manually in every controller.

---

## 9. Admin and Super Admin

- **User (Role: USER)**: Can manage their own workspace, channels, and flows.
- **Admin (Role: ADMIN)**: Similar to User but with additional permissions within a team (Phase 4 IAM).
- **Super Admin (Role: SUPERADMIN)**:
    - Access to the Global Admin Dashboard (`/admin`).
    - Ability to see platform-wide KPIs (MRR, Total Leads, System Health).
    - **Impersonation Mode**: Securely log into a user's workspace to help troubleshoot.
    - Access to the **Simulation Lab** for global flow templates.

---

## 10. Suggestions for the New Version (Rebranding & Simplification)

### Terminology Updates
| Current Term | Suggested New Term | Reason |
| :--- | :--- | :--- |
| **Bot** | **Automation** or **AI Assistant** | "Bot" can sound cold; "Automation" implies a tool for the user. |
| **Flow** | **Workflow** or **Routine** | More intuitive for business users. |
| **Tenant** | **Workspace** or **Company** | Standard SaaS terminology. |

### Architectural Simplifications
1. **Default "Global" Bot**:
    - **Requirement**: "In this new version, we may not offer bots... every user actually uses a default bot."
    - **Implementation**: During user registration, automatically create one Bot named "Default Assistant". Hide the "Bots" menu from the UI.
    - **UI Change**: Move "Channels" and "Flows" to the top-level navigation. When a user creates a channel, it automatically links to the hidden "Default Assistant".
2. **Flow-First Navigation**:
    - Instead of "Manage Bot -> Manage Flow", the user goes directly to "Workflows".
    - A "Master Workflow" is assigned to all channels by default.
3. **Unified Inbox Branding**:
    - Ensure the "ReplyBase" logo and colors are easily replaceable via a single `theme.config.ts` or environment variables.
4. **Remove Multi-Bot Overhead**:
    - Clean up the database schema (in the long term) or simply filter for the first bot found for a tenant in the short term.
    - Simplify API routes to remove `botId` from the URL structure where possible (e.g., `/api/flows` instead of `/api/bots/[id]/flows`).

---

*Prepared by Jules, Lead Engineer.*

### Branding Consistency Checklist
- **Logo & Favicon**: Replace assets in `public/image/replybase-logo.jpg` and `public/favicon.ico`.
- **Primary Branding Constant**: Update the branding name and URL in `lib/lead-notifications.ts` (search for `REPLYBASE_LOGO_URL`) and `components/Logo.tsx`.
- **System Emails**: Customize the sender name and templates in `lib/email.ts` (if applicable) and NextAuth email provider settings.
- **Onrender Subdomain**: If deploying to Render, update the service name to generate the new branded `.onrender.com` URL.
