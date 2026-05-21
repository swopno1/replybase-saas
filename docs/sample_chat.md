# ReplyBase Omnichannel Conversational Scenarios

This document showcases our 4 channel-specific master flows in action. Each scenario illustrates how the bot acts as a high-value growth consultant—capturing name and email in the first few replies, handling manual validation/confirmation, and routing to standard subflows without sounding overly salesy.

---

## Scenario 1: Website Visitor (Webchat Channel)
* **Objective:** Capture name & email from an anonymous web visitor, confirm the email, deliver web conversion insights, and route to the **Pricing Subflow**.
* **Flow Used:** [ReplyBase_website_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_website_master.json)

```markdown
🤖 Bot: 👋 Welcome to ReplyBase! I'm your digital growth consultant. I help businesses double their leads and automate after-hours support across WhatsApp, Telegram, and Webchat.
      
      To tailor my suggestions for your business, what is your name?

👤 Visitor: Hey there, I'm Alex.

🤖 Bot: Nice to meet you, Alex! 🚀 Where should I email your custom ROI breakdown and after-hours automation mockup so you don't lose progress?

👤 Visitor: alex.design@

🤖 Bot: That doesn't look like a valid email. Could you double-check your email address?

👤 Visitor: Sorry about that, it's alex.design@gmail.com

🤖 Bot: Great! Is alex.design@gmail.com the correct email for your account?
        [✅ Yes, looks good] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, looks good)

🤖 Bot: (Action: Auto-tags user with ["lead", "channel_website", "manually_confirmed"])
        
        Thanks, Alex! I've pre-configured your digital dashboard.
        
        💡 Consultant suggestion: Over 74% of website visitors leave forever if they don't get an answer in 2 minutes. By connecting your website chat with a WhatsApp/Telegram channel, ReplyBase lets you continue the conversation on their phones automatically. It's the ultimate lead-generation convenience.
        
        What would you like to explore next?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: (Clicks: 📊 See Pricing & ROI)

🤖 Bot: (Action: Invokes Sub-Flow: Pricing & Lead Capture)
        I'd love to prepare a tailored ROI breakdown for your setup. 
        What kind of business do you run? (e.g. Real Estate, Clinic, eCommerce)...
```

---

## Scenario 2: Mobile Visitor (WhatsApp Channel)
* **Objective:** Leverage existing phone connection, capture name, capture & confirm email, deliver mobile open-rate consultation, and route to the **Demo/Omnichannel Sync Subflow**.
* **Flow Used:** [ReplyBase_whatsapp_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_whatsapp_master.json)

```markdown
👤 Visitor: Hello, saw your tool on Twitter.

🤖 Bot: 👋 Hello! Welcome to the ReplyBase WhatsApp Consultant. Since we're chatting here on WhatsApp, your phone contact is already securely synced! 🟢
      
      I help businesses automate customer chat without losing the human touch. To get started, what is your name?

👤 Visitor: Marcus Vance

🤖 Bot: Great to meet you, Marcus! To link this WhatsApp chat to your Web Dashboard and send your custom ROI & pricing breakdown, what is your best email?

👤 Visitor: marcus@vancecorp.co

🤖 Bot: Perfect! Is marcus@vancecorp.co the correct email to sync your workspace?
        [✅ Yes, confirm email] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, confirm email)

🤖 Bot: (Action: Auto-tags user with ["lead", "channel_whatsapp", "whatsapp_synced"])

        Awesome, Marcus! Your workspace is synced and ready.
        
        💡 Consultant suggestion: WhatsApp conversations have a 98% open rate compared to just 20% for email. By automating WhatsApp FAQs and routing hot leads to your team, businesses using ReplyBase see an average 3.2x increase in sales conversions. It is absolute convenience for customer retention.
        
        What is your main goal today?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: (Clicks: 📱 See Live Demo)

🤖 Bot: (Action: Invokes Sub-Flow: Omnichannel Demo)
        The best way to understand ReplyBase is to see it work. Since we are chatting here on WhatsApp, click below to sync this chat to your web browser instantly...
```

---

## Scenario 3: Social Media Visitor (Facebook Messenger Channel)
* **Objective:** Skip name capture (Facebook profile name is auto-loaded in metadata), ask for email with active manual correction flow, deliver Facebook response-time consultation, and route to **Booking/Human Handoff Subflow**.
* **Flow Used:** [ReplyBase_facebook_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_facebook_master.json)

> [!WARNING]
> **Legacy / Parked Channel:** Facebook Messenger is currently parked and out of active product focus for the 2026 release cycle. This scenario is kept for future design reference.

```markdown
🤖 Bot: 👋 Welcome to ReplyBase! We've automatically linked your Facebook Messenger profile to our support hub.
      
      I'm your virtual automation consultant. What is the best email to send your customized ROI breakdown and set up your 14-day trial dashboard?

👤 Visitor: info@replybase

🤖 Bot: That doesn't look like a valid email. Could you double-check your email address?

👤 Visitor: sorry typo, info@mybiz.com

🤖 Bot: Perfect! Can you confirm if info@mybiz.com is correct?
        [✅ Yes, that's correct] [✍️ No, edit email]

👤 Visitor: (Clicks: ✍️ No, edit email)

🤖 Bot: No worries, what is the correct email address?

👤 Visitor: contact@mybiz.com

🤖 Bot: Perfect! Can you confirm if contact@mybiz.com is correct?
        [✅ Yes, that's correct] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, that's correct)

🤖 Bot: (Action: Auto-tags user with ["lead", "channel_facebook", "fb_synced"])

        Perfect, you're all set! 🚀
        
        💡 Consultant suggestion: Facebook Messenger is a goldmine for customer acquisition, but over 62% of social media users expect a response within 10 minutes. ReplyBase automatically captures leads from comments and messages instantly, keeping your pipeline full and syncs everything with your CRM.
        
        What would you like to explore first?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: I'd like to book a call to discuss enterprise features. (Triggers booking intent via NLP)

🤖 Bot: (Action: Invokes Sub-Flow: Booking & Escalation)
        I'd be happy to get a human expert on the line for you. They can give you a deep-dive walkthrough of how ReplyBase fits into your specific workflow.
        (Skips email question since contact_email was confirmed as contact@mybiz.com)
        Perfect! I've sent your request to our team. In the meantime, you can pick a time that works for you here: calendly.com/replybase-enterprise
```

---

## Scenario 4: Professional Networker (Telegram Channel)
* **Objective:** Capture name & email, deliver Telegram B2B consultant suggestions, handle random user question through AI Fallback Orchestrator.
* **Flow Used:** [ReplyBase_telegram_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_telegram_master.json)

```markdown
🤖 Bot: 👋 Welcome to the ReplyBase Telegram Consultant Bot! I'm here to show you how easily you can automate customer queries and capture leads using our tools.
      
      To get started, what should I call you?

👤 Visitor: Dmitry

🤖 Bot: Great to connect, Dmitry! What's the best email to send your custom ROI report and setup link?

👤 Visitor: dmitry.tech@outlook.com

🤖 Bot: Perfect. Is dmitry.tech@outlook.com correct?
        [✅ Yes, correct] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, correct)

🤖 Bot: (Action: Auto-tags user with ["lead", "channel_telegram", "tg_synced"])

        Excellent, Dmitry! I've updated your lead profile.
        
        💡 Consultant suggestion: Telegram is incredibly fast and highly secure, making it popular for B2B and tech clients. By integrating Telegram with ReplyBase, you get instant webhooks, CRM sync, and the convenience of managing all your chats from one dashboard.
        
        What is your main goal today?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: Do you guys support custom LLM fine-tuning integrations? (Does not match predefined buttons)

🤖 Bot: (Condition: No contains pricing, demo, booking, trial -> fallback)
        (Action: Handover to AI Fallback Orchestrator / Human Inbox)
        
        🤖 Bot (AI Fallback): "Hi Dmitry, yes! ReplyBase allows enterprise users to connect custom LLM endpoints (like OpenAI Assistants or fine-tuned Anthropic models) via our API. I am flagging your profile for our systems architect so they can discuss the custom LLM setup with you on our call!"
```
