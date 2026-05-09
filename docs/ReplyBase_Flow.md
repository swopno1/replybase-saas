# ReplyBase Master Orchestration: Conversational Revenue Engine (V6 Production Final)

This document defines the high-performance, cost-controlled, stateful architecture for the ReplyBase AI Concierge. It relies on strict deterministic fallbacks, identity stitching, and confidence-based AI extraction to ensure zero CRM corruption and zero broken conversion loops.

---

## ⚙️ MODULE 1: GLOBAL STATE & IDENTITY ENGINE
Before any AI runs, the system evaluates the user's explicit state to prevent billing chaos and context hallucination.

### 1.1 Subscription State Router (Pre-Chat)
Upon connection, system checks user email or browser cookie_id against the database:
- **status == "active"** ➔ Route to `Subflow: Customer_Support / Billing_Portal`
- **status == "trial_consumed"** ➔ Remove "Start Free Trial" CTAs; Replace with "Upgrade Now"
- **status == "enterprise_prospect"** ➔ Bypass AI Fallback; route heavily to `Subflow: Human_Booking`
- **status == "anonymous"** ➔ Proceed to Standard Hub Logic

### 1.2 Conversation Memory Expiry (TTL)
- **Session Decay (session_ttl: 7_days)**: If a user returns after 7 days, wipe situational memory but keep CRM traits.
- **Greeting Logic**: "👋 Welcome back, {{name}}. It's been a few days—are we still looking at automating your {{business_type}} setup, or do you have a new focus today?"

---

## 🎛️ MODULE 2: HIERARCHICAL COST-CONTROL ROUTING
To protect profit margins, not every message hits GPT-4 / Claude Opus.

- **Layer 1: Deterministic / Regex (Cost: $0.00)**
  - Triggers on explicit button clicks or exact match keywords (e.g., "pricing", "human", "cancel").
  - **Action**: Routes directly to appropriate Sub-Flow.
- **Layer 2: Fast Intent & Extraction Classifier (Cost: Low - e.g., GPT-3.5 / Haiku)**
  - Classifies user intent and attempts data extraction.
  - **Action**: Passes intent and entities to Orchestrator.
- **Layer 3: Generative Fallback AI (Cost: High - e.g., GPT-4o / Claude 3.5 Sonnet)**
  - Used ONLY for complex technical Q&A, objection handling, or deep consultation.

---

## 🧠 MODULE 3: THE AI ORCHESTRATOR (THE HUB)

### 3.1 Confidence-Based Data Extraction
The AI extracts `business_type`, `primary_channels`, and `monthly_volume`. It MUST assign a confidence score (0.0 to 1.0) to prevent CRM hallucination.
- **Confidence > 0.85**: Silent auto-save.
- **Confidence 0.60 - 0.84**: Soft confirmation required.
  - *Bot*: "Just to confirm, it sounds like you're handling around 10k messages across Facebook and Web. Is that right?"
- **Confidence < 0.60**: Hard prompt.
  - *Bot*: "I want to give you an exact ROI estimate. Roughly how many messages do you handle a month?"

### 3.2 Intent-Weighted Sales Pressure (Anti-Fatigue)
The Fallback AI adjusts how aggressively it pushes CTAs based on conversational context:
- **High Intent** (Asking about features, integrations): CTA attached to every answer.
- **Research Intent** (Asking general API docs, data privacy): Provide info. Ask a follow-up question. CTA only every 3rd turn.
- **Objection State** (Pricing concerns, missing features): Zero CTA. Focus entirely on value recovery and offer `Subflow: Human_Booking`.

### 3.3 Hard Escalation Boundaries (Human Safety Net)
The AI immediately terminates generation and triggers `Subflow: Human_Escalation` if the user input contains:
- `intent: billing_dispute`
- `intent: refund_request`
- `intent: enterprise_security / compliance`
- `sentiment: angry / frustrated`

---

## 📦 MODULE 4: THE SUB-FLOWS (THE SPOKES)

### 📍 Sub-Flow 1: Welcome & Onboarding
- **Node**: `welcome_start`
- **Type**: `message`
- **Message**: "👋 Hey — welcome to ReplyBase. We automate customer conversations across Webchat, Messenger, and WhatsApp without losing the human touch.\n\nWhat's your main goal today?"
- **Buttons**:
  - 📊 See Pricing & ROI ➔ `Trigger: subflow_pricing`
  - 📱 See Live Demo ➔ `Trigger: subflow_demo`
  - 📅 Book a Walkthrough ➔ `Trigger: subflow_booking`

### 📍 Sub-Flow 2: Pricing, ROI & Lead Capture
- **Node**: `pricing_discovery`
- **Logic**: Check `monthly_volume` state. If missing or confidence < 0.85, ask. Else, skip to `plan_recommendation`.
- **Node**: `plan_recommendation`
- **Message**: "For a {{business_type}} handling {{monthly_volume}} messages, the Pro Plan is your best fit. It allows you to recover leads missed after hours and centralizes {{primary_channels}} for total CRM continuity."
- **Node**: `roi_lead_capture`
- **Message**: "I've generated a clear ROI projection for your setup. Where should I email the breakdown so you can review it later with your team?"
- **Action**: Validate email. `Trigger: send_roi_webhook`.
- **Next**: Provide Checkout or Booking options.

### 📍 Sub-Flow 3: Omnichannel Continuity Demo (Hardened)
*This replaces the fragile "say HELLO" mechanic with a cryptographic token handshake to guarantee identity stitching.*
- **Node**: `demo_intro`
- **Message**: "The best way to understand ReplyBase is to see it work. We are chatting here on the website, but if you click the WhatsApp link below, our system will sync this session to your phone instantly."
- **Action**: Generate `{{session_hash}}`.
- **Buttons**:
  - 🟢 Switch to WhatsApp (URL: `wa.me/{{number}}?text=SYNC_{{session_hash}}`)
  - 🔵 Switch to Telegram (URL: `t.me/{{bot}}?start=SYNC_{{session_hash}}`)
  - 💬 Stay here ➔ `Trigger: hub_fallback`
- **System Backend Logic**: When the WhatsApp API receives `SYNC_abc123`, it merges the Webchat CRM profile with the WhatsApp Phone Number. Bot replies on WhatsApp: "Session synced! 👋 Picking up exactly where we left off. You were looking at the Pro Plan..."

### 📍 Sub-Flow 4: Stateful Secure Checkout
- **Node**: `checkout_portal`
- **Logic Rule**:
  - If `user.state == trial_consumed` ➔ Generate Standard Payment Link.
  - If `user.state == new_lead` ➔ Generate 14-Day Free Trial Link.
- **Message**: "Excellent. I've pre-configured your secure checkout page using your email ({{lead_email}}) so you can start in seconds."
- **Buttons**:
  - [💳 Go to Secure Checkout (URL: {{stripe_url}})]
  - [Wait, I have a question] ➔ `Trigger: hub_fallback`

### 📍 Sub-Flow 5: Human Booking & Escalation
- **Node**: `booking_start`
- **Triggered by**: User request, Enterprise threshold, or AI Escalation logic.
- **Message Logic**:
  - *If Standard Booking*: "Let's get you set up. What date and time works best for a 15-min walkthrough?"
  - *If Escalation*: "I want to make sure you get the most accurate guidance on this. I'm pulling in a human specialist."
- **Action**: Hand over to Live Chat queue OR trigger Calendar API.

---

## 🛟 MODULE 5: RECOVERY & ABANDONMENT AUTOMATION
The orchestrator monitors state asynchronously. If a user enters a conversion sub-flow but drops off, system executes recovery logic:

1. **The In-Chat Nudge (45s of silence)**:
   - "Just checking in—did you want me to email your recommended setup so you don't lose your progress?"
2. **The Checkout Abandonment (1 hour post-click)**:
   - **Condition**: `checkout_clicked == true` AND `subscription_active == false`.
   - **Action**: Send Email. "Hey {{name}}, ready to activate that trial? Here's your secure link to resume: {{stripe_url}}"
3. **The Post-Demo Abandonment (24 hours)**:
   - **Condition**: `omnichannel_verified == true` AND `subscription_active == false`.
   - **Action**: Send Email. "You saw how seamless the cross-platform memory is. Ready to build it for {{business_type}}?"

---

## 📊 CRM ENRICHMENT METRICS
Variables pushed to CRM (HubSpot/Internal) on every update:
- `lead_score` (Int)
- `business_type` (String)
- `monthly_volume` (Int)
- `primary_channels` (Array)
- `omnichannel_verified` (Boolean)
- `checkout_abandoned` (Boolean)
- `escalation_triggered` (Boolean)
- `objection_category` (String - e.g., "pricing", "tech")