# 🌊 ReplyBase Conversational Flows Documentation

## 📖 Introduction
ReplyBase uses a modular, logic-driven flow system to automate multi-channel communications (Webchat, Facebook, Telegram, and WhatsApp). This document details our flow designs, step-by-step logic, and channel-specific behaviors.

---

## 🏗️ Core Flow Architecture

### 1. The Entry Layer (The Orchestrator)
Every interaction begins with an intent check. The Orchestrator routes the user based on their initial message or interaction point.

- **Trigger**: New message or button click.
- **Logic**: NLP intent detection or keyword matching.
- **Fallbacks**: If intent is unclear, the bot uses "Warm Re-engagement" to ask clarifying questions.

---

## 📋 Default Flow Templates

### 🌟 Welcome Flow (Triage & Routing)
**Purpose**: Greet new visitors and route them to the appropriate department or information.
- **Step 1**: Friendly greeting (e.g., "Hi! I'm [Bot Name]. How can I help today?")
- **Step 2**: Intent options (Explore Features, Pricing, Support, or Speak to Human).
- **Step 3**: Routing based on selection.
- **Error Handling**: If no selection, wait 2 minutes and offer a "Still there?" nudge.

### 📈 Lead Generation (Qualification Funnel)
**Purpose**: Qualify inbound prospects without friction.
- **Step 1**: Capture pain point (e.g., "What's your biggest support challenge?")
- **Step 2**: Capture company size/industry.
- **Step 3**: Contact info capture (Email/Phone).
- **Validation**: Ensures email/phone formats are correct.
- **Admin Handoff**: If the lead is "High Value" (based on company size), notify the sales team immediately.

### 📅 Booking & Appointment Flow
**Purpose**: Automate scheduling for service-based businesses.
- **Step 1**: Service selection.
- **Step 2**: Date/Time preference capture.
- **Step 3**: Confirmation and contact sync.
- **Fallback**: If the requested time is unavailable, suggest the next 3 open slots.

---

## 📱 Channel-Specific Behaviors

| Channel | Behavior | Feature Support |
|---------|----------|-----------------|
| **Webchat** | Instant, visual buttons, persistent window. | Quick Replies, Rich Text, Images. |
| **Facebook** | Asynchronous, persistent history. | Quick Replies, Postbacks, Persistent Menu. |
| **WhatsApp** | Notification-driven, low latency. | List Messages, Reply Buttons. |
| **Telegram** | Command-driven, bot-focused. | Inline Keyboards, Commands (`/start`). |

---

## 🛠️ Error Handling & Fallback Logic

1. **Unrecognized Input**: "I'm not sure I understood that. Did you mean [Option A] or [Option B]?"
2. **Timeout Handler**: If a user stops mid-flow, the session remains active for 30 minutes before resetting.
3. **Escalation**: Any flow can be overridden by a human agent in the CRM. The bot is automatically "paused" when a human sends a message.

---

## 👩‍💼 Admin Management

Admins can manage flows per subscriber via the **Admin Subscriber Management** dashboard:
- **Assign Flows**: Manually link a specific flow to a subscriber's channel.
- **Override Status**: Force-activate or deactivate flows.
- **View Performance**: Monitor drop-off rates and completion metrics for every node.

---

## 🚀 Recommendations for Improvement

1. **Sentiment Analysis**: Implement real-time sentiment detection to escalate frustrated users to humans faster.
2. **A/B Testing**: Allow admins to run two versions of a flow to see which converts better.
3. **Dynamic Logic**: Use external API calls (Webhooks) within flows to fetch real-time data (e.g., order status).
