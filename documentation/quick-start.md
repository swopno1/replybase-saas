---
title: Quick Start Guide
description: Get from account creation to a working ReplyBase channel with the current dashboard flow
---

# Quick Start Guide

This guide follows the product flow that is currently implemented in the ReplyBase SaaS dashboard.

Estimated time: 15 to 25 minutes

By the end, you will have:

- created your workspace
- opened the bot builder from ReplyBase
- connected at least one live channel
- confirmed where conversations, contacts, and leads appear in the dashboard

## Step 1: Create Your Account

1. Visit [app.replybase.co.uk](https://app.replybase.co.uk)
2. Open Sign Up.
3. Choose one of the currently supported account paths:
   - Google sign-in
   - Email and password registration
4. If you register with email and password, ReplyBase creates a new tenant workspace automatically.
5. After sign-in, you land in the main dashboard.

Notes:

- The login UI currently shows Apple as a placeholder, but it is not active.
- Registration requires first name, last name, email, and a password with at least 8 characters.

## Step 2: Choose Your Plan

ReplyBase currently shows four plans in the pricing and billing flow:

- **Free**: £0/month
- **Starter**: £19/month
- **Pro**: £49/month
- **Business**: £99/month

Paid plans currently advertise a 14-day free trial in the UI. You can upgrade from the Billing page or start from the Pricing page.

## Step 3: Create Your First Bot

1. Open **Bots** from the left sidebar.
2. Review any bots already in your workspace.
3. Use the bot creation flow if you need a new bot.
4. Use **Launch Builder** to open the external bot builder through ReplyBase.

Important:

- Builder access is intentionally launched through ReplyBase, not by sending users directly to the external builder URL.
- Subscription status is checked before builder access is granted.

## Step 4: Design Your Conversation Flow

ReplyBase currently supports two conversation-design surfaces:

- the external builder launched from **Bots**
- the in-app **Flows** area for creating and managing conversational flows

In the **Flows** section you can:

- create a new flow
- edit or duplicate an existing flow
- activate or deactivate a flow
- assign a flow to a Facebook page
- review lead and session counts per flow

## Step 5: Connect Your First Channel

ReplyBase currently exposes three user-facing integration screens:

- **Facebook Pages**
- **Telegram Bot**
- **Webchat Widget**

Choose the one that matches your rollout plan.

### Option A: Facebook Pages

1. Open **Facebook Pages** from the sidebar.
2. Click **Connect with Facebook**.
3. Authorize ReplyBase to access pages you manage.
4. Select the page you want to link.
5. After connection, go to **AI Status** to enable AI replies for that page.

What to expect:

- The dashboard shows total pages, connected pages, and AI-enabled pages.
- Facebook is the most prominent first-run setup path in the dashboard today.

### Option B: Telegram Bot

Prerequisites:

- You already created at least one ReplyBase bot in **Bots**
- You can access **@BotFather** in Telegram to create or manage bot tokens

1. Open **Telegram Bot** from the sidebar.
2. Select which ReplyBase bot should power Telegram replies.
3. Paste the bot token from **@BotFather**.
4. Optionally give the channel a friendly internal name.
5. Click **Connect Bot**.

Token notes:

- Token format is usually `number:secret` (for example: `123456789:ABC...`)
- Keep this token secret; anyone with the token can control your bot

What ReplyBase handles for you:

- validates your token against Telegram
- sets the webhook URL and secret token automatically
- records webhook health and delivery telemetry
- provides reconnect and disconnect actions
- shows recent webhook activity logs for that Telegram channel

If connection fails:

- confirm you copied the full token from **@BotFather**
- verify your bot still exists in Telegram
- verify your deployment URL is HTTPS in production

### Option C: Webchat Widget

1. Open **Webchat Widget** from the sidebar.
2. Choose a bot.
3. Create or select a web channel.
4. Configure title, primary color, welcome message, and launcher position.
5. Save the site configuration and allowed domains.
6. Copy the generated embed snippet into your website.
7. Use the built-in test harness before going live.

## Step 6: Test Your Bot

After you connect a channel, validate the full operator workflow:

1. Send a real test message through the connected channel.
2. Open **Conversations** to confirm the conversation record exists.
3. Open **Contacts** to confirm the contact profile appears.
4. Open **Leads** if your flow collects lead data.
5. Open **Activity** only for a basic overview. The current activity page still uses placeholder/mock data.

For Telegram specifically:

1. Open Telegram and send `/start` (or any message) to your bot.
2. Wait a few seconds and verify your bot replies.
3. In ReplyBase, open **Telegram Bot** and confirm webhook status is active.
4. If there is no reply, check **Recent Webhook Activity** and use **Reconnect Webhook**.

## Step 7: Know Where To Manage Things

- **Dashboard**: top-level health, AI status, connected pages, engine status, last message timestamp
- **Bots**: bot list and builder launch
- **Flows**: flow creation, duplication, activation, assignment
- **Facebook Pages**: page connection and status
- **Telegram Bot**: token-based bot setup and webhook logs
- **Webchat Widget**: website chat setup, keys, embed snippet, diagnostics
- **Billing**: current plan, trial state, billing portal access
- **Settings**: basic account details only at the moment

## Known MVP Limits

- The Activity page is not yet backed by a full real event feed.
- Usage accounting and advanced analytics are only partially implemented.
- Settings is currently a lightweight account page, not a full workspace administration area.

[Explore Features](/docs/features) | [View Roadmap](/docs/roadmap) | [Get Support](/contact) | [Launch Dashboard](https://app.replybase.co.uk)
