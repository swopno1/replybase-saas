# ReplyBase Flow Engine & Qualification Guide

## 1. Flow Design & Scenario Configuration

Each flow in ReplyBase is built using a modular, logic-driven sequence of nodes that guide the user through a conversation. The Flow Engine orchestrates the interactions and adapts dynamically based on user input, variables, and context.

### Key Concepts

- **Nodes:** The building blocks of a flow, which include messages, inputs, actions, and conditions.
- **Modularity:** Flows can be customized per business, industry, or use case, allowing for highly flexible conversation paths.
- **Dynamic Configuration:**
  - **Conditional Branching:** The flow can branch out based on user input or stored variables (e.g., routing high-budget leads differently than low-budget ones).
  - **Sub-flows:** Reusable mini-flows for specialized tasks such as lead capture, booking, or support escalation.
  - **Action Nodes:** Trigger external integrations or internal processes (e.g., booking an appointment, processing a checkout, checking a schedule).
- **Context-Aware Triggers:** Flows can be triggered by various entry points including web chat, API calls, and channel integrations. The behavior can adapt based on user type, channel specifics, and business settings.

---

## 2. Lead Qualification Logic

A key function of the Flow Engine is converting anonymous conversations into qualified leads. This happens automatically when specific criteria are met.

### How It Works

1. **Data Capture:** As the user interacts with the flow, key variables are collected (e.g., name, email, phone number, business type, intent).
2. **Validation:** The captured data is validated (using tools like Zod schemas) to ensure data integrity (e.g., verifying an email format).
3. **Qualification:** A conversation is officially marked as a "qualified lead" when all necessary variables are successfully captured.
   - *Customizable Criteria:* Qualification logic can be customized per flow or business type. For example, a B2B SaaS flow might require a budget range, while a healthcare flow might require a preferred appointment time.
4. **Storage & Tagging:** All captured lead data is tagged and stored in the CRM, ready for follow-up actions or hand-off to a human agent.

---

## 3. Conversation Qualification (Web Chat UX Improvement)

To prevent inflated metrics and ensure high data quality, we implement strict conversation qualification logic, particularly for web chat interactions.

### The Problem
If every interaction (e.g., a simple click to open the chat widget) is counted as a conversation, the metrics become skewed, and the CRM is flooded with empty sessions.

### The Solution: "First Reply" Qualification
For web chat, a session is only considered a true conversation if the site visitor sends at least **one reply or message**.

- **Exclusion:** If a visitor clicks the chatbot but does not send a message or interact with a prompt, the session is **not** counted as a conversation or lead.
- **UX Improvement Strategy:**
  - **Low-Friction Prompt:** Encourage the first reply with a friendly, inviting prompt (e.g., *"Say hi or ask a question to get started!"*).
  - **Delayed Tracking:** Only after the user sends their first reply do we:
    1. Start the conversation timer.
    2. Qualify the session as a legitimate conversation.
    3. Begin the lead capture logic.

This approach ensures that only engaged users are tracked, providing accurate, business-relevant metrics.

---

## 4. Scenario Examples

Here are a few concrete examples of how flows handle different scenarios:

### Example A: Lead Generation
**Goal:** Capture and qualify a high-intent prospect.
- **Flow Logic:** The flow asks a series of questions to collect the prospect's name, email, business type, and budget.
- **Qualification:** The lead is only marked as "qualified" after *all* required fields (including budget) are provided. If they drop off early, they remain a "contacted" or "new" lead depending on the data captured.

### Example B: Support Routing
**Goal:** Resolve issues quickly and escalate only when necessary.
- **Flow Logic:** The flow branches based on the user's selected issue type (e.g., Billing vs. Technical).
- **Qualification/Escalation:** The flow attempts to solve the issue automatically using knowledge base articles. It only escalates to a human agent if the user explicitly confirms they still need help after reviewing the automated response.

### Example C: Booking & Appointments
**Goal:** Automate scheduling without double-booking.
- **Flow Logic:** The flow checks business hours and available slots dynamically.
- **Qualification:** The flow only confirms the booking and qualifies the lead after the user selects an available time and provides their contact details. If a slot is unavailable, the flow intelligently suggests alternative times.
