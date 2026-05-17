# ReplyBase Dedicated Webchat Conversational Scenarios

This document outlines realistic, end-to-end conversation journeys for website visitors using the **ReplyBase Webchat Master Orchestrator** and our unified suite of supportive subflows. 

These scenarios showcase:
1. The **`sanitizeNameInput`** regex utility stripping greetings automatically.
2. **Pre-defined buttons** guiding navigation seamlessly.
3. **Multi-conditional check gates** (supporting `lead_email` in memory and `contact_email` from DB) to prevent duplicate input prompts.
4. **Database-compatible variable mapping** (`lead_name` and `lead_email`) ensuring successful lead persistence.
5. **Dynamic greeting interpolation** (`{{lead_name}}{{contact_name}}`) working perfectly for both new and returning users.
6. **Polished, human-centric copywriting** representing a supportive growth assistant rather than a robotic agent.

---

## Scenario 1: The Direct Trial Checkout Path (High Intent)
* **Goal:** Guide a high-intent visitor through the initial lead capture, confirm their identity, and transition them to starting a 14-day free trial on our premium **Pro Plan** without redundant email prompts.
* **Flows Traversed:** 
  1. [ReplyBase_website_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_website_master.json) (Master Orchestrator)
  2. [ReplyBase_SubFlow_Checkout.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_SubFlow_Checkout.json) (Checkout Subflow)

### Dialogue Transcript

```markdown
🤖 Bot: 👋 Welcome to ReplyBase!
      
      I help businesses automate customer conversations, capture more leads, and reply instantly across WhatsApp, webchat, and social messaging.
      
      To tailor my suggestions for your business, what is your name?

👤 Visitor: Hey there, I'm Sarah.

🤖 Bot: (Action: Engine runs sanitizeNameInput("Hey there, I'm Sarah.") -> Stored in session as variable `lead_name`: "Sarah")

        Nice to meet you, Sarah! 🚀 What's the best email address to send your personalised ROI breakdown and free trial setup?

👤 Visitor: sarah.creative@

🤖 Bot: That doesn't look like a valid email. Could you double-check your email address?

👤 Visitor: Whoops, it's sarah.creative@gmail.com

🤖 Bot: (Action: Saves to variable `lead_email`: "sarah.creative@gmail.com")

        Great! Is sarah.creative@gmail.com the correct email for your account?
        [✅ Yes, looks good] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, looks good)

🤖 Bot: (Action: Runs tag_user action -> Triggers persistLeadCapture which maps lead_name and lead_email to Contact record in DB. Auto-tags user with ["lead", "channel_website", "manually_confirmed"])
        
        Thanks, Sarah! I've pre-configured your digital dashboard.
        
        ReplyBase helps continue conversations through WhatsApp and webchat automatically — helping businesses capture more leads and respond faster 🚀
        
        What would you like to explore next?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: (Clicks: 🚀 Start Free Trial)

🤖 Bot: (Action: Invokes Sub-Flow: ReplyBase_SubFlow_Checkout)
        (Evaluation: Node 0 checks lead_email and contact_email. "sarah.creative@gmail.com" contains "@" -> Skips to Order 2)
        (Action: Node 2 tags user with ["checkout_interest"])
        
        Excellent choice! 🚀 Setting up takes less than 2 minutes and is free for 14 days. No credit card required to test the features.
        
        Which plan matches your business scale best?
        [👤 Starter Trial (£29/mo)] [👥 Pro Trial (£99/mo) (Recommended)] [🏢 Enterprise Custom]

👤 Visitor: (Clicks: 👥 Pro Trial (£99/mo) (Recommended))

🤖 Bot: (Action: Invokes checkout action. Compiles stripeUrl using customer_email=sarah.creative@gmail.com)
        
        Outstanding! The Pro Plan recovered an average of 92% of after-hours leads for our partners by syncing Webchat, WhatsApp, and CRM. Tap here to start your 14-day Pro trial: https://buy.stripe.com/trial?client_reference_id=cmox3h0uw000013nwaubo2wm8&customer_email=sarah.creative@gmail.com
```

---

## Scenario 2: The Value-Driven Evaluation Path (Pricing ➡️ Live Demo ➡️ WhatsApp Sync)
* **Goal:** Guide a hesitant visitor through a structured discovery journey. They review transparent pricing, explore our live demo, and trigger a seamless, native omnichannel switch to WhatsApp.
* **Flows Traversed:**
  1. [ReplyBase_website_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_website_master.json) (Master Orchestrator)
  2. [ReplyBase_SubFlow_Pricing.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_SubFlow_Pricing.json) (Pricing Subflow)
  3. [ReplyBase_SubFlow_Demo.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_SubFlow_Demo.json) (Demo Subflow)

### Dialogue Transcript

```markdown
🤖 Bot: 👋 Welcome to ReplyBase!
      
      I help businesses automate customer conversations, capture more leads, and reply instantly across WhatsApp, webchat, and social messaging.
      
      To tailor my suggestions for your business, what is your name?

👤 Visitor: Hello, my name is daniel vance

🤖 Bot: (Action: Engine runs sanitizeNameInput("Hello, my name is daniel vance") -> Stored in session as `lead_name`: "Daniel Vance")

        Nice to meet you, Daniel Vance! 🚀 What's the best email address to send your personalised ROI breakdown and free trial setup?

👤 Visitor: daniel.vance@vancetech.com

🤖 Bot: Great! Is daniel.vance@vancetech.com the correct email for your account?
        [✅ Yes, looks good] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, looks good)

🤖 Bot: (Action: Runs tag_user action -> Triggers persistLeadCapture. Updates Contact in DB. Auto-tags user with ["lead", "channel_website", "manually_confirmed"])
        
        Thanks, Daniel Vance! I've pre-configured your digital dashboard.
        
        ReplyBase helps continue conversations through WhatsApp and webchat automatically — helping businesses capture more leads and respond faster 🚀
        
        What would you like to explore next?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: (Clicks: 📊 See Pricing & ROI)

🤖 Bot: (Action: Invokes Sub-Flow: ReplyBase_SubFlow_Pricing)
        (Evaluation: Node 0 checks lead_email and contact_email. Daniel's email is present -> Skips to Order 2)
        
        (Action: Node 2 asks business type query)
        To give you the most accurate pricing and ROI estimate, what type of business do you run?

👤 Visitor: We run a growing SaaS agency.

🤖 Bot: (Action: Saves to variable `business_type`. Runs tag_user. updates DB. Auto-tags with ["lead", "pricing_interest"])
        
        ReplyBase is built as the ultimate tool for automated lead generation. We offer simple, transparent pricing designed to scale with your volume:
        
        👤 **Starter (£29/mo):** 1 live channel, up to 500 messages, and standard automation.
        👥 **Pro (£99/mo) (Most Popular):** All channels (Web, WhatsApp, FB, TG), CRM sync, and automated after-hours captures.
        🏢 **Enterprise (Custom):** Custom fine-tuned LLM setups, custom webhook integrations, and SLAs.
        
        Setting up takes 2 minutes and includes a 14-day free trial. What makes the most sense for your scale?
        [🚀 Start 14-Day Free Trial] [📱 Try Live Demo] [📅 Book a Strategy Call]

👤 Visitor: (Clicks: 📱 Try Live Demo)

🤖 Bot: (Action: Invokes Sub-Flow: ReplyBase_SubFlow_Demo)
        
        The best way to see the convenience of ReplyBase is in action. We are chatting here on our website, but our system can sync this conversation directly to your phone instantly!
        
        (Evaluation: Node 1 checks lead_email and contact_email. Daniel's email is present -> Skips to Order 3)
        (Action: Node 3 tags user with ["demo_interest"])
        
        Ready to experience omnichannel magic? Click below to switch this chat to your phone. I will remember everything we've talked about so far!
        
        Or if you prefer, we can review plans or start a trial directly.
        [🟢 Switch to WhatsApp] [🔵 Switch to Telegram] [🚀 Start 14-Day Trial] [📊 See Pricing & ROI]

👤 Visitor: (Clicks: 🟢 Switch to WhatsApp)

🤖 Bot: (Action: Generates sync switch link using dynamic sync_hash)
        
        Perfect! Let's continue on WhatsApp. Click this link to sync our session instantly: https://wa.me/447700900077?text=SYNC_cmox3h0uw000013nwaubo2wm8
```

---

## Scenario 3: The Enterprise Inquiry & Scheduling Path (Booking ➡️ Pricing Continuity)
* **Goal:** Support a B2B corporate prospect who triggers our representative booking flow, schedules a strategy call via Calendly, and is guided back to explore Pricing to prevent dead-ends.
* **Flows Traversed:**
  1. [ReplyBase_website_master.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_website_master.json) (Master Orchestrator)
  2. [ReplyBase_SubFlow_Booking.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_SubFlow_Booking.json) (Booking Subflow)
  3. [ReplyBase_SubFlow_Pricing.json](file:///Users/mdamirhossain/ViveScript-Solutions/projects/ReplyBase/replybase-development/docs/templates/ReplyBase_SubFlow_Pricing.json) (Pricing Subflow)

### Dialogue Transcript

```markdown
🤖 Bot: 👋 Welcome to ReplyBase!
      
      I help businesses automate customer conversations, capture more leads, and reply instantly across WhatsApp, webchat, and social messaging.
      
      To tailor my suggestions for your business, what is your name?

👤 Visitor: I'm Marcus from Enterprise Logistics.

🤖 Bot: (Action: Engine runs sanitizeNameInput("I'm Marcus from Enterprise Logistics.") -> Stored as `lead_name`: "Marcus From Enterprise Logistics")

        Nice to meet you, Marcus From Enterprise Logistics! 🚀 What's the best email address to send your personalised ROI breakdown and free trial setup?

👤 Visitor: marcus@enterpriselogistics.com

🤖 Bot: Great! Is marcus@enterpriselogistics.com the correct email for your account?
        [✅ Yes, looks good] [✍️ No, edit email]

👤 Visitor: (Clicks: ✅ Yes, looks good)

🤖 Bot: (Action: Runs tag_user action -> Triggers persistLeadCapture. Updates Contact in DB. Auto-tags user with ["lead", "channel_website", "manually_confirmed"])
        
        Thanks, Marcus From Enterprise Logistics! I've pre-configured your digital dashboard.
        
        ReplyBase helps continue conversations through WhatsApp and webchat automatically — helping businesses capture more leads and respond faster 🚀
        
        What would you like to explore next?
        [📊 See Pricing & ROI] [📱 See Live Demo] [📅 Book a Walkthrough] [🚀 Start Free Trial]

👤 Visitor: I'd like to schedule a strategy call to discuss custom integrations. (Triggers booking intent via NLP keyword "schedule")

🤖 Bot: (Action: Invokes Sub-Flow: ReplyBase_SubFlow_Booking)
        
        I’d be happy to connect you with a member of our team who can walk you through how ReplyBase could fit your business and workflow.
        
        (Evaluation: Node 1 checks lead_email and contact_email. Marcus's email is present -> Skips to Order 3)
        (Action: Node 3 tags user with ["booking_interest"])
        
        (Action: Node 4 executes booking action)
        Perfect — your request has been sent to our team and someone will be in touch shortly.
        
        In the meantime, you can book a convenient time here: calendly.com/replybase-consulting
        
        While you prepare for the call, is there anything else I can assist you with?
        
        To help make our call as valuable as possible, what would you like to explore next?
        [📊 See Pricing & ROI] [📱 Try Live Demo] [🚀 Start 14-Day Trial]

👤 Visitor: (Clicks: 📊 See Pricing & ROI)

🤖 Bot: (Action: Invokes Sub-Flow: ReplyBase_SubFlow_Pricing)
        (Evaluation: Node 0 checks lead_email and contact_email. Marcus's email is present -> Skips to Order 2)
        
        (Action: Node 2 asks business type)
        To give you the most accurate pricing and ROI estimate, what type of business do you run?

👤 Visitor: Enterprise distribution and 3PL warehousing.

🤖 Bot: (Action: Updates DB with business type. Tags user. Outputs plan comparison...)
        
        ReplyBase is built as the ultimate tool for automated lead generation...
```
