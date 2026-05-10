/**
 * Starter Template Definitions for Flow Builder
 *
 * All message nodes include:
 *   - delayMs: pause before this node fires (ms)
 *   - typingEnabled: show typing indicator before the message
 *   - typingDurationMs: how long the typing indicator shows (ms)
 */

export type FlowTemplateCategory =
  // Universal
  | "welcome"
  | "lead-generation"
  | "lead-capture"
  // Professional / B2B
  | "real-estate"
  | "services"
  | "agencies"
  | "booking"
  | "ecommerce"
  | "saas"
  // Fitness
  | "boutique-gym"
  | "personal-training"
  | "crossfit-gym"
  | "boot-camp"
  | "yoga-studio"
  // Beauty & Wellness
  | "hair-salon"
  | "barbershop"
  | "day-spa"
  | "nail-salon"
  // Home Services
  | "cleaning-services"
  | "landscaping"
  | "handyman"
  // Personal Services
  | "pet-care"
  | "care-services"
  // Hospitality & Leisure
  | "restaurant"
  | "hotel"
  | "golf-club";

export interface FlowTemplateDefinition {
  name: string;
  description: string;
  category: FlowTemplateCategory;
  icon: string;
  group: string;
  nodes: Array<{
    type: string;
    content: Record<string, unknown>;
    order: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const WELCOME_TEMPLATE: FlowTemplateDefinition = {
  name: "Orchestra Welcome: Intent-Driven Greeting",
  description:
    "A sophisticated orchestrator flow that uses conversational intelligence to detect user intent and route them to the right consultant module.",
  category: "welcome",
  icon: "🌍",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 👋 I'm your ReplyBase assistant. I noticed you landed on our page—super excited to have you here! 🚀",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "A quick question before we dive in: Are you here to explore how AI chatbots can transform your support, or are you curious about how ReplyBase specifically works for your team?",
        variableName: "user_intent_raw",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
        quick_replies: [
          { "title": "💰 Pricing", "payload": "price" },
          { "title": "✨ Features", "payload": "feature" },
          { "title": "🏢 Business", "payload": "business" },
          { "title": "❓ Something else", "payload": "other" }
        ]
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "user_intent_raw",
            operator: "contains",
            value: "price",
            nextNodeOrder: 3,
          },
          {
            variableName: "user_intent_raw",
            operator: "contains",
            value: "cost",
            nextNodeOrder: 3,
          },
          {
            variableName: "user_intent_raw",
            operator: "contains",
            value: "feature",
            nextNodeOrder: 4,
          },
          {
            variableName: "user_intent_raw",
            operator: "contains",
            value: "work",
            nextNodeOrder: 4,
          },
          {
            variableName: "user_intent_raw",
            operator: "contains",
            value: "business",
            nextNodeOrder: 5,
          },
          {
            variableName: "user_intent_raw",
            operator: "contains",
            value: "team",
            nextNodeOrder: 5,
          },
        ],
        nextNodeOrder: 6,
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "Smart question. 💰 ReplyBase pricing is based on conversation volume, not seats, which usually saves teams 30-50%. Before I give you the numbers, what's your rough monthly conversation volume?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 10,
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "I'd love to show you the magic! ✨ From Smart Intent Recognition to seamless Human Handoff, we've got you covered. What's the biggest support challenge you're looking to solve right now?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 10,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "That helps a ton! 🏢 Business users usually care most about ROI and reliability. To give you the most relevant info, what industry are you in? (e.g. SaaS, E-commerce, Agency)",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 10,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Got it. No matter what brought you here, we're ready to help. 🙌 What would moving the needle on your customer experience actually look like for your bottom line?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 10,
      },
      order: 6,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};

export const LEAD_GENERATION_TEMPLATE: FlowTemplateDefinition = {
  name: "Orchestra Lead-Gen: Stealth Consultant",
  description:
    "A non-linear, consultant-style flow that captures high-value lead data through conversational bridges rather than rigid forms.",
  category: "lead-generation",
  icon: "👥",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "Love it! 🚀 Understanding your specific needs helps me recommend the right fit, because enterprise teams need something totally different than solo creators.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Quick question to frame this—are you looking at this for personal projects or to empower your whole team? 😊",
        variableName: "lead_segment",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "👤 Personal", "payload": "personal" },
          { "title": "👥 Team / Business", "payload": "team" }
        ]
      },
      order: 1,
    },
    {
      type: "message",
      content: {
        text: "That makes total sense. [Acknowledge context]. SaaS and E-commerce teams usually find that ReplyBase cuts repetitive support time by 70%.",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "By the way, I'm speaking with...?",
        variableName: "lead_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{lead_name}}! What's the best work email to send an ROI breakdown to? 📧",
        variableName: "lead_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "And just ballpark—how many support conversations is your team handling per day? 10? 100? 1000+?",
        variableName: "lead_volume_daily",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Got it! That volume is a sweet spot for automation. 🎯 I've passed your details to our senior strategists, and they'll reach out to {{lead_email}} within 1 business day with a tailored plan.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["lead", "orchestra-qualified", "consultant-vetted"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

export const LEAD_CAPTURE_TEMPLATE: FlowTemplateDefinition = {
  name: "Lead Capture: High-Speed Engagement",
  description:
    "A ultra-fast engagement flow designed to capture essential contact details while the lead's intent is highest.",
  category: "lead-capture",
  icon: "⚡",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 👋 I'll keep this fast so you can get back to what matters.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's the best email for us to send the info you requested? 📧",
        variableName: "contact_email",
        inputType: "email",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "And who should we address the message to? 😊",
        variableName: "contact_name",
        inputType: "text",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "Thanks, {{contact_name}}! 🙏 We're on it. Check your inbox at {{contact_email}} in the next few minutes. Anything else I can help with while you wait?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["lead", "high-speed-capture", "intent-captured"],
      },
      order: 4,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 5,
    },
  ],
};

export const OMNICHANNEL_DEMO_TEMPLATE: FlowTemplateDefinition = {
  name: "Revenue Engine: Omnichannel Demo",
  description:
    "A high-impact demo flow that showcases identity stitching by moving users from Webchat to WhatsApp/Telegram while maintaining session continuity.",
  category: "lead-generation",
  icon: "🔄",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "The best way to understand ReplyBase is to see it work. 🚀 We are chatting here on the website, but our system can sync this conversation to your phone instantly.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "message",
      content: {
        text: "Ready to see the magic? ✨ Click below to switch to WhatsApp. I'll remember everything we've talked about so far.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🟢 Switch to WhatsApp", "payload": "wa.me/{{wa_number}}?text=SYNC_{{session_hash}}" },
          { "title": "🔵 Switch to Telegram", "payload": "t.me/{{tg_bot}}?start=SYNC_{{session_hash}}" },
          { "title": "💬 Stay here", "payload": "STAY_HERE" }
        ]
      },
      order: 1,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};

export const BOOKING_ESCALATION_TEMPLATE: FlowTemplateDefinition = {
  name: "Revenue Engine: Booking & Escalation",
  description:
    "A conversion-focused flow for high-touch demo requests and seamless human agent handoff.",
  category: "booking",
  icon: "📅",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "I'd be happy to get a human expert on the line for you. 👨‍💻 They can give you a deep-dive walkthrough of how ReplyBase fits into your specific workflow.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's the best email to use for the calendar invite? 📧",
        variableName: "lead_email",
        inputType: "email",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "action",
      content: {
        action: "booking",
        text: "Perfect! I've sent your request to our team. In the meantime, you can pick a time that works for you here: {{booking_link}}",
        bookingService: "calendly"
      },
      order: 2,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};


// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL / B2B TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const REAL_ESTATE_TEMPLATE: FlowTemplateDefinition = {
  name: "Real Estate: Buyer & Seller Consultant",
  description:
    "A sophisticated real estate flow that qualifies buyer and seller intent with high-intent tagging and viewing-request actions.",
  category: "real-estate",
  icon: "🏡",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏡 Whether you're hunting for your dream home or looking to make a strategic move, I'm here to ensure the process is seamless.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "To get started, are you primarily looking to buy a new property, sell your current home, or perhaps arrange a viewing for a listing that caught your eye?",
        variableName: "property_goal",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🏘️ Buy a Property", "payload": "buy" },
          { "title": "📈 Sell my Home", "payload": "sell" },
          { "title": "🔑 Arrange Viewing", "payload": "viewing" }
        ]
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "property_goal",
            operator: "contains",
            value: "sell",
            nextNodeOrder: 3,
          },
          {
            variableName: "property_goal",
            operator: "contains",
            value: "valuation",
            nextNodeOrder: 3,
          },
          {
            variableName: "property_goal",
            operator: "contains",
            value: "buy",
            nextNodeOrder: 5,
          },
          {
            variableName: "property_goal",
            operator: "contains",
            value: "viewing",
            nextNodeOrder: 7,
          },
        ],
        nextNodeOrder: 9,
      },
      order: 2,
    },
    // Seller Path
    {
      type: "input",
      content: {
        text: "Excellent choice. Strategic sellers always get the best results. 📈 What's the postcode of the property you're thinking of selling?",
        variableName: "seller_postcode",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Got it. We'll prepare a preliminary market report for {{seller_postcode}}. What's the best number for our valuation expert to reach you on? 📞",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 11,
      },
      order: 4,
    },
    // Buyer Path
    {
      type: "input",
      content: {
        text: "Fantastic! 🏘️ To find the perfect match, what's your preferred area and rough budget range?",
        variableName: "buyer_preferences",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "That helps a lot. We have several off-market listings in that range. What email should we send these exclusive properties to? 📧",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 11,
      },
      order: 6,
    },
    // Viewing Path
    {
      type: "input",
      content: {
        text: "Of course! Nothing beats seeing a property in person. 🔑 Which listing are you interested in, and what's your name?",
        variableName: "viewing_request_info",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 7,
    },
    {
      type: "message",
      content: {
        text: "Great to meet you! We'll coordinate with the owners right away. What's the best phone number to confirm your viewing time? 📱",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 11,
      },
      order: 8,
    },
    // Default/Other
    {
      type: "message",
      content: {
        text: "No problem at all. If you share what's on your mind and the best way to reach you, I'll make sure one of our senior agents gets back to you personally. 🙌",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 15,
      },
      order: 9,
    },
    // Finalization
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["real-estate-lead", "intent-qualified", "agent-handoff-requested"],
      },
      order: 11,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 12,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 15,
    },
  ],
};

export const SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Services: Expert Consultation & Quote",
  description:
    "Perfect for service providers. Qualifies project urgency and scope while capturing high-intent lead data with automated tagging.",
  category: "services",
  icon: "🛠️",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 👋 Thanks for reaching out. We pride ourselves on delivering high-quality solutions for projects exactly like yours.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "To make sure I connect you with the right specialist, tell me a bit about the main challenge you're looking to solve today. 🛠️",
        variableName: "service_description",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Makes sense. Is this something you need resolved urgently, or are you in the planning phase for a later date? 📅",
        variableName: "urgency_status",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "🚨 Urgent (ASAP)", "payload": "urgent" },
          { "title": "📅 Planning (1-3 months)", "payload": "planning" },
          { "title": "💡 Just Researching", "payload": "research" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Got it. And who should our team ask for when they reach out with your personalized quote? 😊",
        variableName: "customer_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{customer_name}}! What's the best phone number to reach you on for a quick 5-minute discovery chat? 📞",
        variableName: "phone_number",
        inputType: "phone",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Perfect. ✅ Let's schedule a quick call to go over the details: [SCHEDULE_LINK]",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "schedule",
        scheduleLink: "[SCHEDULE_LINK]",
        tags: ["service-request", "new-enquiry"],
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 7,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 8,
    },
  ],
};

export const AGENCIES_TEMPLATE: FlowTemplateDefinition = {
  name: "Agencies: Project Discovery & Strategy",
  description:
    "Built for digital agencies. Discovers project scope, goals, and budget using the Orchestra System's non-linear consultative approach.",
  category: "agencies",
  icon: "🚀",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🚀 We're excited to hear about your vision. Let's get the core strategy down so we can connect you with the right strategist.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "In a nutshell, what are the primary goals you're looking to achieve with this project? 🚀",
        variableName: "project_goals",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "📈 Lead Generation", "payload": "lead_gen" },
          { "title": "✨ Brand Refresh", "payload": "branding" },
          { "title": "🌐 Digital Transformation", "payload": "transformation" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Got it—visionary goals! ✨ To help our strategists scope this accurately, do you have a rough budget range in mind?",
        variableName: "budget_range",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "💳 Under £10k", "payload": "<10k" },
          { "title": "🏢 £10k-£50k", "payload": "10k-50k" },
          { "title": "🚀 £50k+", "payload": ">50k" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Makes total sense. And what's your ideal timeline for hitting those milestones?",
        variableName: "project_timeline",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Perfect. Where should we send our initial thoughts and a preliminary strategy outline? 📧",
        variableName: "contact_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Fantastic! 🎯 One of our senior strategists will review your brief and follow up at {{contact_email}} within 1 business day. Ready to see some of our previous success stories while you wait?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["agency-lead", "discovery-complete", "high-intent"],
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 7,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 8,
    },
  ],
};

export const BOOKING_TEMPLATE: FlowTemplateDefinition = {
  name: "Booking: Concierge Appointment Scheduler",
  description:
    "A high-conversion booking flow that qualifies needs before securing a slot. Includes 'booking-initiated' actionable tagging.",
  category: "booking",
  icon: "📅",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 📅 Ready to book your spot? Let's sort out the details.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Which service or specialist are you looking to book with today? 😊",
        variableName: "service_type",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "📅 Consultation", "payload": "consultation" },
          { "title": "🛠️ Service / Repair", "payload": "service" },
          { "title": "❓ Other Info", "payload": "other" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Excellent. And who am I looking forward to seeing? (Just your name is fine!)",
        variableName: "client_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{client_name}}! What's the best phone number for us to send your booking confirmation to? 📱",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Got it. Finally, what's your preferred date and time? We'll do our absolute best to prioritize you. 🕒",
        variableName: "preferred_datetime",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks! ✅ We've received your request. Let's get you booked in right away: [BOOKING_LINK]",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "booking",
        bookingService: "general",
        tags: ["booking-request", "new-appointment"],
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 7,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 8,
    },
  ],
};

export const ECOMMERCE_TEMPLATE: FlowTemplateDefinition = {
  name: "E-commerce: Order Concierge & Sales",
  description:
    "A retail-optimized flow that handles order tracking, shopping assistance, and dynamic discount offerings with high-intent tagging.",
  category: "ecommerce",
  icon: "🛍️",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 👋 Looking for something special today? I'm your personal shopping concierge, here to help you find the perfect fit or track your latest haul.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What can I do for you right now? 🛍️",
        variableName: "ecommerce_intent",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "📦 Track Order", "payload": "track" },
          { "title": "🛍️ Browse Shop", "payload": "browse" },
          { "title": "🎁 Get Discount", "payload": "discount" }
        ]
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "ecommerce_intent",
            operator: "contains",
            value: "track",
            nextNodeOrder: 3,
          },
          {
            variableName: "ecommerce_intent",
            operator: "contains",
            value: "order",
            nextNodeOrder: 3,
          },
          {
            variableName: "ecommerce_intent",
            operator: "contains",
            value: "browse",
            nextNodeOrder: 4,
          },
          {
            variableName: "ecommerce_intent",
            operator: "contains",
            value: "shop",
            nextNodeOrder: 4,
          },
          {
            variableName: "ecommerce_intent",
            operator: "contains",
            value: "discount",
            nextNodeOrder: 6,
          },
        ],
        nextNodeOrder: 7,
      },
      order: 2,
    },
    // Tracking Path
    {
      type: "message",
      content: {
        text: "I'll fetch that for you! 📦 Just share your order number and email, and I'll pull the latest status from our warehouse in seconds.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 10,
      },
      order: 3,
    },
    // Browsing Path
    {
      type: "message",
      content: {
        text: "Great! You can browse our full collection right here. Want to check out now? Let's complete your purchase! [STORE_URL]/checkout 🛍️ And here's a little secret: use code WELCOME10 for 10% off!",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 9,
      },
      order: 4,
    },
    // Discount Path
    {
      type: "message",
      content: {
        text: "Who doesn't love a deal? 🎁 Use WELCOME20 for 20% off your first purchase! What kind of products are you hoping to use that on?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 10,
      },
      order: 6,
    },
    // Default Path
    {
      type: "message",
      content: {
        text: "No problem. Just share what's on your mind and your email, and one of our dedicated support team will get back to you personally. 😊",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 15,
      },
      order: 7,
    },
    // Actionable Node
    {
      type: "action",
      content: {
        action: "checkout",
        checkoutUrl: "[STORE_URL]/checkout",
      },
      order: 9,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 15,
    },
  ],
};

export const SAAS_TEMPLATE: FlowTemplateDefinition = {
  name: "SaaS: ROI & Product Consultant",
  description:
    "A sophisticated SaaS qualification flow that reframes features into ROI and business value. Includes 'demo-scheduled' intent tagging.",
  category: "saas",
  icon: "💻",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 🚀 Interested in seeing how [PRODUCT_NAME] can specifically move the needle for your team? I'm here to show you the path to ROI.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "To give you the most relevant context, what's your current team size? 🏢",
        variableName: "company_size",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "👤 1-10", "payload": "1-10" },
          { "title": "👥 11-50", "payload": "11-50" },
          { "title": "🏢 50+", "payload": "50+" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Got it. Enterprise teams and small squads have different priorities. What's the #1 friction point you're hoping our tool will solve for you?",
        variableName: "primary_pain_point",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "That's exactly what we excel at. 🎯 Many teams like yours report a 40%+ increase in efficiency within the first 60 days of solving that exact challenge.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Would you like to jump into a 15-minute high-level walkthrough with one of our product experts to see the ROI in action? ✨",
        variableName: "demo_requested",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "📅 Book Demo", "payload": "yes" },
          { "title": "💡 Not now, show features", "payload": "no" }
        ]
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Excellent. What's your work email address so we can send the priority invite? 📧",
        variableName: "work_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Perfect choice! ✅ I've sent a priority link to {{work_email}}. Pick a time that works for you, and we'll see you then. Ready to explore our case studies while you wait?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["saas-lead", "demo-requested", "roi-qualified"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FITNESS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const BOUTIQUE_GYM_TEMPLATE: FlowTemplateDefinition = {
  name: "Boutique Gym: Transformation Discovery",
  description:
    "A value-first gym flow with intent branching. Delivers class info, tour offers, or membership details before capturing lead data.",
  category: "boutique-gym",
  icon: "🏋️",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 💪 Welcome to our community. We're not just a gym — we're here to help you rewrite your fitness story.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What brings you here today? 😊",
        variableName: "gym_interest",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
        quick_replies: [
          { "title": "🏋️ Join the Gym", "payload": "join" },
          { "title": "🔥 Try a Class", "payload": "class" },
          { "title": "👀 Book a Tour", "payload": "tour" },
        ],
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          { variableName: "gym_interest", operator: "contains", value: "join", nextNodeOrder: 3 },
          { variableName: "gym_interest", operator: "contains", value: "member", nextNodeOrder: 3 },
          { variableName: "gym_interest", operator: "contains", value: "class", nextNodeOrder: 4 },
          { variableName: "gym_interest", operator: "contains", value: "tour", nextNodeOrder: 5 },
        ],
        nextNodeOrder: 6,
      },
      order: 2,
    },
    // Membership Path
    {
      type: "message",
      content: {
        text: "Great choice! 🙌 We offer flexible memberships with no lock-in contracts — including unlimited classes, open gym access, and a free starter session with a coach. Most new members see results within 4 weeks.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 7,
      },
      order: 3,
    },
    // Class Path
    {
      type: "message",
      content: {
        text: "Love it! 🔥 We run HIIT, Strength, Yoga, and Boxing classes daily — and your first session is always free. Check our full timetable here: [CLASS_TIMETABLE_URL]",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 7,
      },
      order: 4,
    },
    // Tour Path
    {
      type: "message",
      content: {
        text: "You're welcome anytime! 👀 We offer free guided tours 7 days a week. You'll see the gym floor, studios, and meet one of our coaches. No commitment required.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 7,
      },
      order: 5,
    },
    // Default Path
    {
      type: "message",
      content: {
        text: "No problem! Whatever your fitness goal — strength, weight loss, or just feeling better — we'll find the right path for you. 💪",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 7,
      },
      order: 6,
    },
    // Lead capture (value already delivered)
    {
      type: "input",
      content: {
        text: "I'd love to get our coach to follow up with you personally. What's your name?",
        variableName: "member_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 7,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{member_name}}! What's the best number for a quick 2-minute chat about getting started? 📱",
        variableName: "member_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 8,
    },
    {
      type: "message",
      content: {
        text: "You're all set! 🎉 Our head coach will reach out to {{member_phone}} shortly. We can't wait to see you on the gym floor!",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 9,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["gym-lead", "membership-intent-high", "goal-captured"],
      },
      order: 10,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 11,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 12,
    },
  ],
};

export const PERSONAL_TRAINING_TEMPLATE: FlowTemplateDefinition = {
  name: "Personal Training: Performance Intake",
  description:
    "A high-level client intake flow that assesses level, health history, and availability to match clients with the right coach.",
  category: "personal-training",
  icon: "👟",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🏋️ I'm here to help you smash your personal records. Let's see how we can build a plan that works for you.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your primary focus right now? Strength, fat loss, athletic performance, or longevity? I want to know exactly what moves you.",
        variableName: "pt_focus",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "💪 Strength", "payload": "strength" },
          { "title": "🔥 Fat Loss", "payload": "fat_loss" },
          { "title": "🏅 Performance", "payload": "performance" },
          { "title": "🧘 Longevity", "payload": "longevity" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Love that focus. 💥 How would you describe your current experience level? (e.g. Beginner, Intermediate, or Advanced Athlete)",
        variableName: "pt_experience",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Safety first—any previous injuries or health notes I should pass on to your coach? 🩹",
        variableName: "pt_health_notes",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Got it. And who am I looking forward to training?",
        variableName: "client_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{client_name}}! What's the best phone number for me to reach you on? 📞",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "What times of the week are you usually free for our power sessions? 🕒",
        variableName: "pt_availability",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Brilliant! 💥 I'll review your profile and match you with the best coach for {{pt_focus}}. We'll reach out to {{client_phone}} shortly with a game plan. Ready to work?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["pt-lead", "intake-complete", "high-performance-intent"],
      },
      order: 8,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 9,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};

export const CROSSFIT_GYM_TEMPLATE: FlowTemplateDefinition = {
  name: "CrossFit Gym: Trial & Performance Assessing",
  description:
    "A high-energy flow that assess athlete experience and drives them toward a trial session with 'trial-request' tagging.",
  category: "crossfit-gym",
  icon: "🔥",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 🔥 Welcome to the arena. Ready to see what you're truly made of?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Have you faced the whiteboard before, or is this your first time stepping into a CrossFit box? 🏋️",
        variableName: "cf_experience",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "💪 Faced the Board", "payload": "experienced" },
          { "title": "🆕 First Time", "payload": "newbie" },
          { "title": "❓ Just Curious", "payload": "curious" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Respect! 👊 What's the main goal you're chasing here?",
        variableName: "cf_goal",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
        quick_replies: [
          { "title": "💪 RAW Strength", "payload": "strength" },
          { "title": "🏃 Unbreakable Endurance", "payload": "endurance" },
          { "title": "🏅 Competition", "payload": "competition" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Ready to work. What's your name, athlete?",
        variableName: "athlete_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Welcome to the team, {{athlete_name}}! What's the best email for us to send your intro pack and safety waiver? 📧",
        variableName: "athlete_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "When would you like to come in for your first free intro session and get your first score on the board? 🕒",
        variableName: "intro_date",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Let's go! 🏆 I've prioritized your session. Our head coach will confirm your slot shortly. Get ready for the grind—it's worth it!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["crossfit-lead", "trial-requested", "athlete-onboarding"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

export const BOOT_CAMP_TEMPLATE: FlowTemplateDefinition = {
  name: "Boot Camp: Elite Programme Discovery",
  description:
    "A results-oriented flow that qualifies fitness level and interest for boot camp programmes with 'programme-enquiry' tagging.",
  category: "boot-camp",
  icon: "🏃",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏃 Ready to take your fitness to the next level? I'm here to help you find the perfect challenge.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Which of our elite programmes caught your eye? (e.g., Morning Warrior Boot Camp, High-Intensity HIIT, or Outdoor Power Sessions) 🔥",
        variableName: "programme_interest",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Love that choice. 💥 To match you with the right squad, how would you rate your current fitness?",
        variableName: "fitness_level",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
        quick_replies: [
          { "title": "🆕 Just Starting", "payload": "beginner" },
          { "title": "🏃 Regular Mover", "payload": "intermediate" },
          { "title": "🏅 Advanced Athlete", "payload": "advanced" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Great to know. And what's your name?",
        variableName: "participant_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{participant_name}}! What's the best number to reach you on so we can chat about our upcoming sessions and securing your spot? 📱",
        variableName: "participant_phone",
        inputType: "phone",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Brilliant! 💪 Our lead coaches will be in touch shortly to help you get started. Ready to see the results our latest squad achieved?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["bootcamp-lead", "programme-enquiry", "high-intent"],
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 7,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 8,
    },
  ],
};

export const YOGA_STUDIO_TEMPLATE: FlowTemplateDefinition = {
  name: "Yoga Studio: Wellness Path Discovery",
  description:
    "A mindful flow that captures practice preferences and level to guide students toward their ideal class or membership.",
  category: "yoga-studio",
  icon: "🧘",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Namaste! 🧘 Welcome to our space. We're so happy you've reached out to explore your wellness journey with us.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of practice calls to you today? ✨",
        variableName: "practice_preference",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🧘 Restorative Yin", "payload": "yin" },
          { "title": "🔥 Energetic Vinyasa", "payload": "vinyasa" },
          { "title": "❓ Not Sure", "payload": "unsure" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Beautiful. How much experience do you have on the mat? We welcome everyone, from curious beginners to regular practitioners. 🙏",
        variableName: "yoga_experience",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "I'd love to help you find the right session. By the way, I'm speaking with...?",
        variableName: "student_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Welcome, {{student_name}}! What's the best email address for us to send our latest mindful schedule and a special intro offer? 📧",
        variableName: "student_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Finally, what times of day usually work best for your practice? We'll recommend sessions that fit your rhythm. 🌿",
        variableName: "preferred_rhythm",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Wonderful! 🌿 I've passed your preferences to our studio team. We'll be in touch at {{student_email}} very soon with class options and how to get on the mat. Peace and light.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["yoga-enquiry", "class-booking-intent", "wellness-lead"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BEAUTY & WELLNESS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const HAIR_SALON_TEMPLATE: FlowTemplateDefinition = {
  name: "Hair Salon: Style & Booking Consultant",
  description:
    "A value-first salon flow with service branching. Delivers treatment details before capturing lead data for a seamless booking.",
  category: "hair-salon",
  icon: "💇",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! ✂️ Welcome to our studio. We're here to help you look and feel your absolute best.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What can we do for you today? ✨",
        variableName: "style_service_type",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
        quick_replies: [
          { "title": "✂️ Cut & Style", "payload": "cut" },
          { "title": "🎨 Color / Highlights", "payload": "color" },
          { "title": "✨ Treatment", "payload": "treatment" },
        ],
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          { variableName: "style_service_type", operator: "contains", value: "cut", nextNodeOrder: 3 },
          { variableName: "style_service_type", operator: "contains", value: "style", nextNodeOrder: 3 },
          { variableName: "style_service_type", operator: "contains", value: "color", nextNodeOrder: 4 },
          { variableName: "style_service_type", operator: "contains", value: "highlight", nextNodeOrder: 4 },
          { variableName: "style_service_type", operator: "contains", value: "treatment", nextNodeOrder: 5 },
        ],
        nextNodeOrder: 6,
      },
      order: 2,
    },
    // Cut Path
    {
      type: "message",
      content: {
        text: "Great choice! ✂️ Our stylists specialize in precision cuts and modern styling. Whether you want a fresh trim or a bold new look, we'll match you with the perfect stylist for your hair type.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 7,
      },
      order: 3,
    },
    // Color Path
    {
      type: "message",
      content: {
        text: "Beautiful choice! 🎨 From subtle balayage to full color transformations, our color experts use only premium products. We always start with a quick consultation to find your perfect shade.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 7,
      },
      order: 4,
    },
    // Treatment Path
    {
      type: "message",
      content: {
        text: "Excellent! ✨ Our treatments include deep conditioning, keratin smoothing, and scalp rituals. We'll assess your hair and recommend the best option for you.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 7,
      },
      order: 5,
    },
    // Default Path
    {
      type: "message",
      content: {
        text: "No problem! Whatever you have in mind, our team can help. We offer a full consultation to find the best service for you. 💇‍♀️",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 7,
      },
      order: 6,
    },
    // Lead capture (value already delivered)
    {
      type: "input",
      content: {
        text: "I'd love to get you booked in. What's your name?",
        variableName: "client_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 7,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{client_name}}! What's the best phone number so we can confirm your appointment? 📱",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 8,
    },
    {
      type: "message",
      content: {
        text: "Lovely! 💇 Our concierge will text {{client_phone}} within the hour to confirm your slot. See you soon!",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 9,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["salon-booking", "hair-appointment", "style-intent-captured"],
      },
      order: 10,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 11,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 12,
    },
  ],
};

export const BARBERSHOP_TEMPLATE: FlowTemplateDefinition = {
  name: "Barbershop: Precision Booking",
  description:
    "A fast-paced barbershop flow that captures service types and barber preferences to secure slots quickly.",
  category: "barbershop",
  icon: "💈",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 💈 Welcome to the shop. Looking for a fresh fade, a classic trim, or the full treatment?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service can we get done for you today? (e.g. Skin Fade, Beard Sculpt, or the Full Service) ✂️",
        variableName: "barber_service",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
        quick_replies: [
          { "title": "✂️ Haircut / Fade", "payload": "cut" },
          { "title": "🧔 Beard Sculpt", "payload": "beard" },
          { "title": "🔥 Full Service", "payload": "full" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Got it. Do you have a preferred barber you usually see, or should we find the next available chair for you? 💺",
        variableName: "barber_preference",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Ready to work. What's your name?",
        variableName: "client_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you! What's the best phone number for us to text your confirmation and arrival time? 📱",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "When would you like to come in? Let us know your preferred slot and we'll lock it in. 🕒",
        variableName: "preferred_slot",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Sorted! ✅ I've prioritized your request. We'll check the schedule and text you at {{client_phone}} shortly to confirm your chair. See you soon!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["barbershop-booking", "appointment-enquiry", "service-intent-high"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

export const DAY_SPA_TEMPLATE: FlowTemplateDefinition = {
  name: "Day Spa: Luxury Wellness Booking",
  description:
    "An elegant spa flow that captures treatment goals and special requests for a tailored relaxation experience.",
  category: "day-spa",
  icon: "🌸",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🌸 We're delighted you've chosen to unwind with us. Let's find the perfect ritual for your relaxation.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1300,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of experience calls to you today? ✨",
        variableName: "spa_treatment_goal",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "💆 Restorative Massage", "payload": "massage" },
          { "title": "✨ Skincare Facial", "payload": "facial" },
          { "title": "🛁 Full Ritual", "payload": "ritual" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Beautiful choice. Is this a mindful treat for yourself, or are you arranging a group ritual or a special gift? 🎁",
        variableName: "booking_context",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "👤 For Me", "payload": "self" },
          { "title": "👥 Group Ritual", "payload": "group" },
          { "title": "🎁 Special Gift", "payload": "gift" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "I'd love to arrange this for you. By the way, I'm speaking with...?",
        variableName: "guest_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Welcome, {{guest_name}}! What's the best phone number for us to confirm your details and share our pre-treatment guide? 📱",
        variableName: "guest_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "When would you like to visit us? Let us know your preferred date and time. 🕒",
        variableName: "preferred_datetime",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "Finally, to ensure your comfort, are there any allergies or special requests I should let our therapists know about? 🌿",
        variableName: "spa_special_requests",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Wonderful! 🛁 I've secured your request. Our spa concierge will be in touch shortly to confirm your ritual and share everything you need for a restorative stay.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1300,
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["spa-booking", "treatment-qualified", "wellness-intent-high"],
      },
      order: 8,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 9,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};

export const NAIL_SALON_TEMPLATE: FlowTemplateDefinition = {
  name: "Nail Salon: Art & Booking Concierge",
  description:
    "A stylish nail salon flow that captures service types and art preferences to secure high-value appointments.",
  category: "nail-salon",
  icon: "💅",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 💅 Welcome to our studio. Ready to transform your nails into a work of art?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service are you looking for today? ✨",
        variableName: "nail_service_intent",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "💅 Gel Mani", "payload": "mani" },
          { "title": "✨ Acrylics", "payload": "acrylics" },
          { "title": "🎨 Custom Art", "payload": "art" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Exciting choice! And who am I looking forward to seeing for this transformation?",
        variableName: "client_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Great to meet you, {{client_name}}! What's the best phone number for us to confirm your appointment and send color inspiration? 📱",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Finally, when would you like to come in? Let us know your preferred time and we'll secure your slot. 🕒",
        variableName: "preferred_time",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Fabulous! 💖 I've secured your interest. Our team will check the diary and text you at {{client_phone}} within the hour to confirm your session. Can't wait to see you!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["nail-booking", "beauty-appointment-high-intent", "art-qualified"],
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 7,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 8,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HOME SERVICES TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const CLEANING_SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Cleaning Services: Instant Quote Request",
  description:
    "A property-focused flow that qualifies cleaning needs and size to provide fast, accurate quotes with 'quote-requested' tagging.",
  category: "cleaning-services",
  icon: "🧹",
  group: "Home Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🧹 We'd love to help make your space sparkle. Let's gather a few details so we can get you an accurate quote in seconds.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "To get started, is this for your home or a commercial property? 😊",
        variableName: "property_type",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
        quick_replies: [
          { "title": "🏡 Residential", "payload": "residential" },
          { "title": "🏢 Commercial", "payload": "commercial" },
          { "title": "🔑 End of Tenancy", "payload": "tenancy" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Got it. What kind of clean do you need? ✨",
        variableName: "clean_type_intent",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🧹 Regular Maintenance", "payload": "regular" },
          { "title": "🧼 Deep / Spring Clean", "payload": "deep" },
          { "title": "🧴 Specialized Service", "payload": "special" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Understood. How many bedrooms or main rooms should we factor into the quote?",
        variableName: "property_size_rooms",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "What's the postcode of the property so we can check our local team's availability? 📍",
        variableName: "property_postcode",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Great. And who should we address the quote to?",
        variableName: "customer_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{customer_name}}! What's the best phone number for us to text your quote and check-in details to? 📱",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "input",
      content: {
        text: "Finally, when were you hoping for the sparkle to happen? We'll prioritize your preferred date. 🕒",
        variableName: "preferred_date",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 7,
    },
    {
      type: "message",
      content: {
        text: "Perfect! ✨ I've secured your request. Our estimating team will review the details for {{property_postcode}} and text your quote to {{customer_phone}} very soon. Ready for a cleaner space?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 8,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["cleaning-lead", "quote-requested", "property-vetted"],
      },
      order: 9,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 10,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 11,
    },
  ],
};

export const LANDSCAPING_TEMPLATE: FlowTemplateDefinition = {
  name: "Landscaping & Gardening: Transformation Quote",
  description:
    "A garden-focused flow that captures project scope and visit preferences to drive site assessments and quote conversions.",
  category: "landscaping",
  icon: "🌳",
  group: "Home Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🌿 Thanks for thinking of us. We're excited to help you transform your outdoor space into something extraordinary.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of project do you have in mind today? Whether it's a new designer patio, regular seasonal maintenance, or a total garden redesign, we're all ears. 🌳",
        variableName: "garden_project_intent",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🌳 Design & Build", "payload": "design_build" },
          { "title": "🌿 Maintenance", "payload": "maintenance" },
          { "title": "🚧 Hardscaping", "payload": "hardscaping" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Love that vision. To help us scope the visit, how would you describe the size of your garden? (e.g., Small urban space, Medium family garden, or Large estate?) 🏡",
        variableName: "garden_size",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's the postcode of the property so we can check our local surveyor's schedule? 📍",
        variableName: "property_postcode",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Great. And who should we ask for when we reach out?",
        variableName: "customer_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{customer_name}}! What's the best phone number for us to call and arrange your free assessment? 📱",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "Finally, when would you like us to come by for your free, no-obligation assessment? 🕒",
        variableName: "visit_preference",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Excellent! 🌳 I've secured your request for {{property_postcode}}. Our project team will be in touch at {{customer_phone}} shortly to confirm your visit. Ready to see some of our recent transformations?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 8,
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["landscaping-lead", "assessment-requested", "outdoor-intent-high"],
      },
      order: 8,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 9,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};

export const HANDYMAN_TEMPLATE: FlowTemplateDefinition = {
  name: "Handyman & Repair: Priority Job Booking",
  description:
    "A fast-response repair flow that captures job urgency and location to provide quick dispatch or quotes.",
  category: "handyman",
  icon: "🔧",
  group: "Home Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🔧 Got something that needs fixing? You're in the right place. I'll help you get this resolved quickly.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell me a bit about the job that needs doing. The more detail the better so I can match you with the right specialist! 🛠️",
        variableName: "job_description_raw",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Understood. Is this a priority repair that needs immediate attention, or are you looking to schedule it for a convenient time? 🕒",
        variableName: "job_urgency",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
        quick_replies: [
          { "title": "🚨 Emergency Repair", "payload": "emergency" },
          { "title": "📅 Scheduled Visit", "payload": "scheduled" },
          { "title": "💡 Get a Quote", "payload": "quote" }
        ]
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's the postcode or address where the work needs to be carried out? 📍",
        variableName: "job_location",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Got it. And who should our team ask for when they reach out?",
        variableName: "customer_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{customer_name}}! What's the best phone number for us to call or text you with your priority quote? 📱",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Got it! 🛠️ I've prioritized your repair for {{job_location}}. Our team will review the job and text you at {{customer_phone}} shortly with availability and pricing. Speak soon!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["handyman-lead", "repair-requested", "priority-dispatch"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL SERVICES TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const PET_CARE_TEMPLATE: FlowTemplateDefinition = {
  name: "Pet Care: Tailored Booking & Enquiry",
  description:
    "A pet-centric flow for services that captures animal details and care needs to drive high-value bookings.",
  category: "pet-care",
  icon: "🐾",
  group: "Personal Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🐾 Welcome. We'd love to help look after your furry family members and ensure they have the best experience.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What can we help you with today? Whether it's expert dog walking, professional grooming, or cozy overnight boarding, we're ready to help. 🐶",
        variableName: "pet_service_intent",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🐾 Walking / Daycare", "payload": "walking" },
          { "title": "✂️ Grooming", "payload": "grooming" },
          { "title": "🏠 Boarding", "payload": "boarding" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Tell us a bit about your pet! What kind of animal are they, and what's their name? We love getting to know our guests. 😊",
        variableName: "pet_details",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Lovely. When were you thinking you'd need our help? Let us know the dates or how often you're looking for care. 🕒",
        variableName: "care_schedule",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "And who should we get in touch with to finalize the details?",
        variableName: "owner_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you! What's the best phone number to reach you on for a quick chat about {{pet_details}}? 📱",
        variableName: "owner_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Paw-some! 🐶 I've secured your interest. Our care team will reach out to {{owner_phone}} very soon to confirm everything and answer any questions you have. Can't wait to meet you and {{pet_details}}!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1300,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["pet-care-lead", "service-enquiry", "pet-details-captured"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

export const CARE_SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Child & Elder Care: Compassionate Discovery",
  description:
    "A sensitive flow for care services that captures recipient needs and schedule preferences to match families with the right care coordinator.",
  category: "care-services",
  icon: "💙",
  group: "Personal Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hello! 👋 Thank you for reaching out. We're here to help you find the most compassionate and professional care for your family. Take your time—we're here to listen.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1400,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "To help me guide you, what kind of care are you looking for? 💙",
        variableName: "care_type_intent",
        inputType: "text",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1100,
        quick_replies: [
          { "title": "👶 Childcare", "payload": "childcare" },
          { "title": "👵 Elder Care", "payload": "elder_care" },
          { "title": "🤝 Respite Care", "payload": "respite" }
        ]
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "I understand. If you're comfortable sharing, could you tell us a bit about who the care is for and any specific needs or preferences they might have? 😊",
        variableName: "care_recipient_details",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Thank you. What kind of schedule or frequency are you hoping for? We pride ourselves on being very flexible to fit your family's rhythm. 🕒",
        variableName: "care_schedule_pref",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "We appreciate you sharing that. And who should our care coordinator ask for when they follow up?",
        variableName: "contact_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{contact_name}}. What's the best phone number for us to reach you on for a sensitive, 5-minute chat about your family's needs? 📱",
        variableName: "contact_phone",
        inputType: "phone",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Thank you for sharing your journey with us. 💙 One of our senior care coordinators will reach out to {{contact_phone}} personally very soon to discuss how we can best support your family. We're on this path with you.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1400,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["care-lead", "family-discovery-complete", "high-sensitivity-qualified"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITALITY & LEISURE TEMPLATES (New)
// ─────────────────────────────────────────────────────────────────────────────

export const RESTAURANT_TEMPLATE: FlowTemplateDefinition = {
  name: "Restaurant: Table Concierge & Reservations",
  description:
    "A dining-optimized flow that handles reservations, dietary needs, and menu requests with 'reservation-initiated' tagging.",
  category: "restaurant",
  icon: "🍴",
  group: "Hospitality & Leisure",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hello! 🍴 Welcome to our restaurant. We're delighted you've chosen to dine with us. I'm your digital concierge for the evening.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "How can I help you today? Would you like to secure a table, explore our latest seasonal menu, or do you have a question about our location? 🍷",
        variableName: "restaurant_request_intent",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "📅 Book a Table", "payload": "book" },
          { "title": "🍷 View Menu", "payload": "menu" },
          { "title": "📍 Location / Info", "payload": "location" }
        ]
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "restaurant_request_intent",
            operator: "contains",
            value: "book",
            nextNodeOrder: 3,
          },
          {
            variableName: "restaurant_request_intent",
            operator: "contains",
            value: "reserv",
            nextNodeOrder: 3,
          },
          {
            variableName: "restaurant_request_intent",
            operator: "contains",
            value: "table",
            nextNodeOrder: 3,
          },
          {
            variableName: "restaurant_request_intent",
            operator: "contains",
            value: "menu",
            nextNodeOrder: 11,
          },
        ],
        nextNodeOrder: 12,
      },
      order: 2,
    },
    // Booking Path
    {
      type: "input",
      content: {
        text: "Fantastic! 📅 Let's get you scheduled! For how many people would you like to book, and on what date and time?",
        variableName: "booking_details",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Understood. Are there any dietary requirements or special occasions (like a birthday or anniversary) we should prepare for? 🎂",
        variableName: "special_requests_info",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Perfect. And what's your name so we can secure the reservation for you?",
        variableName: "guest_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "Welcome, {{guest_name}}! What's the best phone number to text your reservation confirmation to? 📱",
        variableName: "guest_phone",
        inputType: "phone",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Excellent! 🥂 Your reservation request is set. Want to secure your table now? [RESERVATION_LINK]",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "booking",
        bookingService: "table",
        tags: ["restaurant-booking", "reservation-request"],
      },
      order: 8,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 9,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
    // Menu Path
    {
      type: "message",
      content: {
        text: "You can find our latest seasonal menu and chef's specials right here: [MENU_URL] 🥗 Hope you find something you love! Ready to book once you've had a look?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 15,
      },
      order: 11,
    },
    // Other/Location Path
    {
      type: "message",
      content: {
        text: "No problem. If you share what's on your mind and the best way to reach you, I'll make sure one of our team gets back to you personally. We're located at [LOCATION_ADDRESS]. 📍",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 15,
      },
      order: 12,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 15,
    },
  ],
};

export const HOTEL_TEMPLATE: FlowTemplateDefinition = {
  name: "Hotel: Reservation & Guest Concierge",
  description:
    "An elegant hotel flow that manages room bookings, amenity enquiries, and check-in details with 'reservation-enquiry' tagging.",
  category: "hotel",
  icon: "🏨",
  group: "Hospitality & Leisure",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏨 We're delighted you're considering a stay with us. I'm here to ensure your visit is perfect from the very first moment.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "How can I assist you today? Would you like to secure a room, or are you looking for information about our luxury amenities and check-in times? ✨",
        variableName: "hotel_request_intent",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🛌 Book a Room", "payload": "book" },
          { "title": "✨ Amenities / Info", "payload": "info" },
          { "title": "📍 Location", "payload": "location" }
        ]
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "hotel_request_intent",
            operator: "contains",
            value: "book",
            nextNodeOrder: 3,
          },
          {
            variableName: "hotel_request_intent",
            operator: "contains",
            value: "reserv",
            nextNodeOrder: 3,
          },
          {
            variableName: "hotel_request_intent",
            operator: "contains",
            value: "stay",
            nextNodeOrder: 3,
          },
        ],
        nextNodeOrder: 10,
      },
      order: 2,
    },
    // Booking Path
    {
      type: "input",
      content: {
        text: "Excellent choice. 🛌 What dates were you thinking of for your stay, and for how many guests should I prepare for?",
        variableName: "stay_details_raw",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Understood. And what's your full name, please? We'll use this for your priority reservation enquiry.",
        variableName: "guest_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Welcome, {{guest_name}}! What's the best email to send your personalized reservation options and exclusive offers to? 📧",
        variableName: "guest_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Perfect. 🥂 Our reservations team will check our availability and send your options to {{guest_email}} shortly. We look forward to welcoming you soon! Ready to see our room gallery?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1300,
        nextNodeOrder: 7,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["hotel-booking", "reservation-enquiry", "high-intent-traveler"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
    // Info Path
    {
      type: "message",
      content: {
        text: "Of course. You can explore our spa rituals, fitness center, and fine dining options right here: [AMENITIES_URL]. 🧖 Check-in begins at 3pm and check-out is by 11am. Do you have any other specific questions for our concierge?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1300,
        nextNodeOrder: 15,
      },
      order: 10,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 15,
    },
  ],
};

export const GOLF_CLUB_TEMPLATE: FlowTemplateDefinition = {
  name: "Golf Club: Tee Time & Membership Concierge",
  description:
    "A premium club flow that handles tee time bookings and membership enquiries with 'tee-time-request' tagging.",
  category: "golf-club",
  icon: "⛳",
  group: "Hospitality & Leisure",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome to the club! ⛳ We're looking forward to seeing you on the green. I'm here to help you coordinate your perfect round.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "How can I assist you today? Would you like to secure a tee time, enquire about our exclusive membership tiers, or find out about our pro shop? 🏌️",
        variableName: "golf_request_intent",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        quick_replies: [
          { "title": "🏌️ Book Tee Time", "payload": "tee" },
          { "title": "🤝 Memberships", "payload": "member" },
          { "title": "🛍️ Pro Shop / Info", "payload": "info" }
        ]
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "golf_request_intent",
            operator: "contains",
            value: "tee",
            nextNodeOrder: 3,
          },
          {
            variableName: "golf_request_intent",
            operator: "contains",
            value: "book",
            nextNodeOrder: 3,
          },
          {
            variableName: "golf_request_intent",
            operator: "contains",
            value: "member",
            nextNodeOrder: 10,
          },
        ],
        nextNodeOrder: 11,
      },
      order: 2,
    },
    // Tee Time Path
    {
      type: "input",
      content: {
        text: "Great! 🏌️ What date and time were you hoping to tee off, and for how many players in your group?",
        variableName: "tee_time_details_raw",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Understood. And what's your full name, please? We'll use this for your priority tee time enquiry.",
        variableName: "guest_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Welcome, {{guest_name}}! What's the best phone number for us to text your tee time confirmation and course conditions to? 📱",
        variableName: "guest_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Perfect! 🏆 I've secured your request. Our course manager will check the schedule and text you at {{guest_phone}} shortly to confirm. Happy golfing! Ready to see the course layout?",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 7,
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["golf-booking", "tee-time-request", "player-intent-high"],
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: 8,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 9,
    },
    // Membership Path
    {
      type: "message",
      content: {
        text: "We'd love to have you join our community! 🤝 You can explore all our premium membership tiers and benefits right here: [MEMBERSHIP_URL]. Would you like me to arrange a personal tour of the clubhouse?",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1300,
        nextNodeOrder: 15,
      },
      order: 10,
    },
    // Other/Pro Shop Path
    {
      type: "message",
      content: {
        text: "No problem. If you share what's on your mind and the best way to reach you, I'll make sure one of our club team gets back to you personally. Our pro shop is open daily from 7am. 🛍️",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 15,
      },
      order: 11,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 15,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export function getAvailableTemplates(): FlowTemplateDefinition[] {
  return [
    // Universal
    WELCOME_TEMPLATE,
    LEAD_GENERATION_TEMPLATE,
    LEAD_CAPTURE_TEMPLATE,
    // Professional / B2B
    REAL_ESTATE_TEMPLATE,
    SERVICES_TEMPLATE,
    AGENCIES_TEMPLATE,
    BOOKING_TEMPLATE,
    ECOMMERCE_TEMPLATE,
    SAAS_TEMPLATE,
    // Fitness
    BOUTIQUE_GYM_TEMPLATE,
    PERSONAL_TRAINING_TEMPLATE,
    CROSSFIT_GYM_TEMPLATE,
    BOOT_CAMP_TEMPLATE,
    YOGA_STUDIO_TEMPLATE,
    // Beauty & Wellness
    HAIR_SALON_TEMPLATE,
    BARBERSHOP_TEMPLATE,
    DAY_SPA_TEMPLATE,
    NAIL_SALON_TEMPLATE,
    // Home Services
    CLEANING_SERVICES_TEMPLATE,
    LANDSCAPING_TEMPLATE,
    HANDYMAN_TEMPLATE,
    // Personal Services
    PET_CARE_TEMPLATE,
    CARE_SERVICES_TEMPLATE,
    // Hospitality & Leisure
    RESTAURANT_TEMPLATE,
    HOTEL_TEMPLATE,
    GOLF_CLUB_TEMPLATE,
  ];
}

export function getTemplateByCategory(
  category: FlowTemplateCategory,
): FlowTemplateDefinition | undefined {
  const templates = getAvailableTemplates();
  return templates.find((t) => t.category === category);
}
