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
  name: "Welcome Flow: Triage & Routing",
  description:
    "A universal entry flow that greets visitors warmly, captures their intent, and routes them to the right path.",
  category: "welcome",
  icon: "🌍",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 👋 Thanks for stopping by. I'm here to make things easy for you.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's on your mind today? Whether it's pricing, booking, or just a quick question, I'm ready to help.",
        variableName: "last_request",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "last_request",
            operator: "contains",
            value: "price",
            nextNodeOrder: 3,
          },
          {
            variableName: "last_request",
            operator: "contains",
            value: "book",
            nextNodeOrder: 4,
          },
        ],
        nextNodeOrder: 5,
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "I'd love to get some pricing options over to you. 💰 If you could just share your name and email, our team will send a tailored package your way shortly.",
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
        text: "Exciting! 📅 Tell me roughly when you were thinking, and we'll check our availability for you right away.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 10,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "No problem at all. If you leave your question and the best way to reach you, I'll make sure one of the team gets back to you personally. 🙌",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 10,
      },
      order: 5,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 10,
    },
  ],
};

export const LEAD_GENERATION_TEMPLATE: FlowTemplateDefinition = {
  name: "Lead Generation: Qualification Funnel",
  description:
    "A conversational way to capture contact details, business info, and requirements for qualification.",
  category: "lead-generation",
  icon: "👥",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "Thanks for reaching out! 🚀 I'd love to help you get started. Let's gather a few bits of info so we can give you the best experience.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "First things first, who am I speaking with? 😊",
        variableName: "lead_name",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 1,
    },
    {
      type: "message",
      content: {
        text: "Good to meet you, {{lead_name}}! 👋",
        delayMs: 200,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's the best email to reach you on?",
        variableName: "lead_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "And a phone number — only if you're happy to share. No worries if not!",
        variableName: "lead_phone",
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
        text: "What kind of business do you run? (e.g. e-commerce, agency, SaaS — anything really)",
        variableName: "lead_business_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "Roughly how many customer conversations does your team handle per week?",
        variableName: "lead_volume",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 6,
    },
    {
      type: "input",
      content: {
        text: "Last one — what's your rough monthly budget for tools like this? (e.g. under £50, £50–£100, or flexible)",
        variableName: "lead_budget",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 7,
    },
    {
      type: "message",
      content: {
        text: "That's really helpful — thank you! 🙌\n\nI've passed your details to the team, and someone will be in touch at {{lead_email}} within 1 business day. In the meantime, feel free to ask me anything.",
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
        tags: ["lead", "qualified", "new-lead"],
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

export const LEAD_CAPTURE_TEMPLATE: FlowTemplateDefinition = {
  name: "Lead Capture: Quick Contact Micro-Flow",
  description:
    "A light and fast way to capture essential lead info without being intrusive. Ideal for any business.",
  category: "lead-capture",
  icon: "⚡",
  group: "Universal",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 👋 I'll keep this quick so we can get you the help you need.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your name?",
        variableName: "contact_name",
        inputType: "text",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "And your email address?",
        variableName: "contact_email",
        inputType: "email",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's the best phone number to reach you?",
        variableName: "contact_phone",
        inputType: "phone",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Briefly, how can we help you today?",
        variableName: "contact_reason",
        inputType: "text",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks so much! 🙏 We've got your details and we'll be in touch very soon.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["lead", "quick-capture"],
      },
      order: 6,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 7,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL / B2B TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const REAL_ESTATE_TEMPLATE: FlowTemplateDefinition = {
  name: "Real Estate: Buyer & Seller Leads",
  description:
    "Tailored for property professionals to help qualify buyer, seller, or rental intent.",
  category: "real-estate",
  icon: "🏡",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏡 Whether you're looking for a new home or thinking of moving on, I'm here to help.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Are you looking to buy, sell, or rent? Or perhaps you'd like to book a viewing?",
        variableName: "property_goal",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
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
            value: "buy",
            nextNodeOrder: 4,
          },
          {
            variableName: "property_goal",
            operator: "contains",
            value: "rent",
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
        text: "Excellent. If you share your property's postcode and a callback number, we can arrange a free, no-obligation valuation. 📞",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 10,
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Fantastic! 🏘️ Let us know your preferred area, budget, and number of bedrooms, and we'll send some matching properties your way.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 10,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "We can certainly help with that. 🔑 Just tell us your target area, monthly budget, and when you're looking to move.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
        nextNodeOrder: 10,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Of course! Tell me which property caught your eye and how we can best reach you, and we'll get that viewing sorted. 📋",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1100,
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

export const SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Services: Qualification & Booking",
  description:
    "Perfect for consultants, plumbers, IT support, and other service providers. Qualifies leads and captures booking requests.",
  category: "services",
  icon: "🛠️",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 👋 Thanks for thinking of us. We're ready to help with your project or any maintenance you need.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell us a bit about what you're looking for help with today.",
        variableName: "service_description",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Is this something urgent, or are you looking to schedule it for a later date?",
        variableName: "urgency",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Great. And who should we ask for when we follow up?",
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
        text: "What's the best phone number to reach you on?",
        variableName: "phone_number",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
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
  name: "Agencies: Project Discovery",
  description:
    "Built for marketing, digital, and design agencies. Discovers project scope, budget, and timeline before human handoff.",
  category: "agencies",
  icon: "🚀",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🚀 We're excited to hear about your project. Let's get the basics down so we can connect you with the right person.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "In a nutshell, what are your main goals for this project?",
        variableName: "project_brief",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Do you have a rough budget range in mind for this work?",
        variableName: "budget_range",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's your ideal timeline for getting this off the ground?",
        variableName: "timeline",
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
        text: "And where should we send our initial thoughts or a proposal?",
        variableName: "email",
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
        text: "Got it! 🎯 One of our strategists will take a look at your brief and follow up with some tailored next steps. Speak soon!",
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
        tags: ["agency-lead", "project-brief"],
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
  name: "Booking: Appointments & Reservations",
  description:
    "Ideal for any booking-heavy business. Confirms service, collects contact info, and captures preferred time.",
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
        text: "What service or appointment are you looking to book today?",
        variableName: "service_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Great choice. And who am I speaking with?",
        variableName: "name",
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
        text: "Nice to meet you, {{name}}! What's the best phone number for us to confirm your booking?",
        variableName: "phone",
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
        text: "What date or time works best for you? We'll do our best to accommodate.",
        variableName: "preferred_time",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
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
  name: "E-commerce: Order Support & Sales",
  description:
    "Help customers find products, track orders, and get discounts. Built for online stores.",
  category: "ecommerce",
  icon: "🛍️",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 👋 Looking for something special today? I can help you find products, track an order, or get you a cheeky discount.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What brings you here? (e.g., browse products, track order, or get help)",
        variableName: "ecommerce_intent",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
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
        ],
        nextNodeOrder: 5,
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "I can definitely help with that. 📦 Please share your order number and email, and I'll fetch the latest status for you.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 10,
      },
      order: 3,
    },
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
    {
      type: "message",
      content: {
        text: "No problem. Just tell me what you need help with and your email, and one of our support team will get back to you shortly. 😊",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 10,
      },
      order: 5,
    },
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
  ],
};

export const SAAS_TEMPLATE: FlowTemplateDefinition = {
  name: "SaaS: Product Qualification & Demo",
  description: "Qualify software leads, gather company details, and schedule product demos with ease.",
  category: "saas",
  icon: "💻",
  group: "Professional & B2B",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 🚀 Interested in seeing how [PRODUCT_NAME] can help your team? I'd love to show you around.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "To get started, what's your company size? (e.g., 1-10, 11-50, or 50+ employees)",
        variableName: "company_size",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "And what's the main challenge you're looking to solve with our tool?",
        variableName: "main_challenge",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Makes sense. Would you like to schedule a quick 15-minute demo with one of our product experts?",
        variableName: "wants_demo",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Perfect. What's your work email address so we can send the invite?",
        variableName: "work_email",
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
        text: "Awesome! ✅ We've sent a calendar link to {{work_email}}. Pick a time that works for you, and we'll see you then!",
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
        tags: ["saas-lead", "demo-requested"],
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
// FITNESS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const BOUTIQUE_GYM_TEMPLATE: FlowTemplateDefinition = {
  name: "Boutique Gym: Membership Enquiry",
  description:
    "Qualifies new membership, class, or tour enquiries. Captures fitness goal, schedule preference, and contact details.",
  category: "boutique-gym",
  icon: "🏋️",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 💪 Welcome to our community. We're excited to help you on your fitness journey.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What brings you here today? Are you thinking about joining, trying a class, or just want a tour?",
        variableName: "gym_interest",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "That sounds great. What's your main fitness goal at the moment?",
        variableName: "fitness_goal",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "I'd love to get you started. What's your name?",
        variableName: "member_name",
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
        text: "Nice to meet you! What's the best number to reach you on for a quick chat about your goals?",
        variableName: "member_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What days or times usually work best for your workouts?",
        variableName: "preferred_schedule",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Awesome! 🙌 I've passed your info to our team. We'll be in touch very soon to get you moving. Can't wait to see you in the gym!",
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
        tags: ["gym-lead", "membership-enquiry"],
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

export const PERSONAL_TRAINING_TEMPLATE: FlowTemplateDefinition = {
  name: "Personal Training: Client Intake",
  description:
    "Captures fitness goals, experience, health notes, and availability before the first session.",
  category: "personal-training",
  icon: "👟",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🏋️ I'm here to help you smash your goals. Let's see how we can best work together.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your number one fitness goal right now? Whether it's strength, fat loss, or just feeling better, I want to know.",
        variableName: "fitness_goal",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "How would you describe your current fitness level? Be honest! (Beginner, Intermediate, or Advanced)",
        variableName: "fitness_level",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Are there any injuries or health bits I should keep in mind?",
        variableName: "health_notes",
        inputType: "text",
        delayMs: 400,
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
        text: "What's the best phone number for me to reach you on?",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "What times of the week are you usually free for our sessions?",
        variableName: "availability",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Brilliant! 💥 I'll take a look at your details and get back to you with a plan to get you started. Talk soon!",
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
        tags: ["pt-enquiry", "new-client"],
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
  name: "CrossFit Gym: Trial & Membership",
  description:
    "Warms up new visitors, assesses experience, and drives them toward a free intro session or membership.",
  category: "crossfit-gym",
  icon: "🔥",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 🔥 Welcome to the box. Ready to see what you're made of?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Have you done CrossFit before, or is this your first time stepping into the arena?",
        variableName: "cf_experience",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's the main thing you want to achieve here? (e.g., strength, endurance, competition)",
        variableName: "cf_goal",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Awesome. What's your name, athlete?",
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
        text: "And what's your email so we can send you some info about our classes?",
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
        text: "When would you like to come in for your first free intro session?",
        variableName: "intro_date",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Let's go! 🏆 We'll confirm your intro session shortly. Get ready for the grind!",
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
        tags: ["crossfit-lead", "trial-request"],
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
  name: "Boot Camp: Programme Enquiry",
  description:
    "Captures programme interest, fitness level, and contact info for outdoor or indoor boot camp programmes.",
  category: "boot-camp",
  icon: "🏃",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏃 Ready to take your fitness to the next level? I'm here to help you get started.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Which of our programmes caught your eye? (e.g., Morning Boot Camp, HIIT, or Outdoor Fitness)",
        variableName: "programme_interest",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "How would you rate your fitness right now? (Beginner, Intermediate, or Advanced)",
        variableName: "fitness_level",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
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
        text: "What's the best number to reach you on so we can chat about our upcoming sessions?",
        variableName: "participant_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Brilliant! 💪 Our coaches will be in touch shortly to help you get started. See you out there!",
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
        tags: ["bootcamp-lead", "programme-enquiry"],
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
  name: "Yoga Studio: Class Booking & Membership",
  description:
    "Captures class preferences, yoga experience level, and schedule to confirm bookings or memberships.",
  category: "yoga-studio",
  icon: "🧘",
  group: "Fitness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Namaste! 🧘 Welcome to our space. We're so happy you've reached out.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of practice are you looking for today? Whether it's a calm Yin class or an energetic Vinyasa flow, we have something for everyone.",
        variableName: "class_preference",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "How much experience do you have with yoga? We welcome all levels, from complete beginners to regular practitioners.",
        variableName: "yoga_experience",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "I'd love to help you find the right class. What's your name?",
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
        text: "And what's your email address so we can send you our latest schedule?",
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
        text: "What times of day usually work best for your practice?",
        variableName: "preferred_schedule",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Wonderful! 🌿 We'll be in touch very soon with class options and how to get on the mat. Peace and light.",
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
        tags: ["yoga-enquiry", "class-booking"],
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
  name: "Hair Salon: Booking & Service Enquiry",
  description:
    "Captures service type, stylist preference, and booking time to confirm hair appointments.",
  category: "hair-salon",
  icon: "💇",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! ✂️ Welcome to our salon. We're here to help you look and feel amazing.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What can we do for you today? Whether it's a fresh cut, a new colour, or a bit of pampering, we've got you covered.",
        variableName: "service_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Do you have a regular stylist you'd like to see, or are you happy for us to find the best match for you?",
        variableName: "stylist_preference",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Fantastic. And who should we get booked in?",
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
        text: "Nice to meet you! What's the best phone number for us to confirm your appointment?",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What date and time would work best for your visit?",
        variableName: "preferred_datetime",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Lovely! 💇 We've got your request. Our team will check the diary and be in touch shortly to confirm everything. See you soon!",
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
        tags: ["salon-booking", "hair-appointment"],
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

export const BARBERSHOP_TEMPLATE: FlowTemplateDefinition = {
  name: "Barbershop: Appointment Booking",
  description:
    "Quick booking flow for cuts, beard trims, and shaves. Captures service, barber preference, and time.",
  category: "barbershop",
  icon: "💈",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 💈 Welcome to the shop. What can we get done for you today?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service are you looking for? (e.g., Haircut, Beard Trim, or the full works)",
        variableName: "service_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Do you have a preferred barber, or should we just find the next available chair?",
        variableName: "barber_preference",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "Got it. What's your name?",
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
        text: "And what's the best phone number for us to confirm your slot?",
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
        text: "When would you like to come in?",
        variableName: "preferred_time",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Sorted! ✅ We'll check the schedule and confirm your slot very soon. See you in the chair!",
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
        tags: ["barbershop-booking", "new-appointment"],
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
  name: "Day Spa: Treatment Booking",
  description:
    "Captures treatment type, booking purpose (self/gift/group), date preference, and special requests.",
  category: "day-spa",
  icon: "🌸",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🌸 We're delighted you've chosen to relax with us. Let's find the perfect experience for you.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1300,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of treatment interests you today? From soothing massages to revitalising facials, we're here to help you unwind.",
        variableName: "treatment_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Is this a treat for yourself, or are you booking for a group or as a special gift?",
        variableName: "booking_for",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "I'd love to get this sorted for you. What's your name?",
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
        text: "And what's your phone number for us to confirm your details?",
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
        text: "When would you like to visit us? Let us know your preferred date and time.",
        variableName: "preferred_datetime",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "Are there any allergies or special requests I should let the therapists know about?",
        variableName: "special_requests",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Wonderful! 🛁 We've received your request. Our team will be in touch shortly to confirm your visit and share everything you need to know for a relaxing stay.",
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
        tags: ["spa-booking", "treatment-enquiry"],
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
  name: "Nail Salon: Appointment Booking",
  description:
    "Fast appointment booking for gel, acrylic, pedicures, and nail art. Captures service, name, and time.",
  category: "nail-salon",
  icon: "💅",
  group: "Beauty & Wellness",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 💅 Welcome to our nail studio. Let's get you booked in for some stunning nails!",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service are you looking for? (e.g., Gel Mani, Acrylics, or some custom nail art?)",
        variableName: "nail_service",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Exciting! And who am I looking forward to seeing?",
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
        text: "Great to meet you! What's the best phone number for us to confirm your appointment?",
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
        text: "When would you like to come in? Let us know your preferred time.",
        variableName: "preferred_time",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Fabulous! 💖 We've got your request. Our team will check the diary and confirm your appointment very soon. Can't wait to see you!",
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
        tags: ["nail-booking", "beauty-appointment"],
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
  name: "Cleaning Services: Quote & Booking",
  description:
    "Qualifies property type, clean type, and size. Captures location and contact details for a fast quote.",
  category: "cleaning-services",
  icon: "🧹",
  group: "Home Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🧹 We'd love to help make your space sparkle. Let's gather a few details for your quote.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Is this for your home or a commercial property?",
        variableName: "property_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What kind of clean do you need? (e.g., Regular Weekly, a deep spring clean, or an End of Tenancy clean?)",
        variableName: "clean_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "How many bedrooms or main rooms are we looking at?",
        variableName: "property_size",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "What's the postcode or area for the property?",
        variableName: "postcode",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Got it. And what's your name?",
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
        text: "What's the best phone number to reach you on for your quote?",
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
        text: "When were you hoping for the clean to happen?",
        variableName: "preferred_date",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 7,
    },
    {
      type: "message",
      content: {
        text: "Perfect! ✨ Thanks for those details. We'll prepare your quote and be in touch very soon to confirm everything.",
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
        tags: ["cleaning-lead", "quote-request"],
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
  name: "Landscaping & Gardening: Quote Request",
  description:
    "Captures service needed, garden size, postcode, and preferred visit date to prepare a no-obligation quote.",
  category: "landscaping",
  icon: "🌳",
  group: "Home Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🌿 Thanks for thinking of us. We're excited to help you transform your outdoor space.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of project do you have in mind? Whether it's a new patio, regular maintenance, or a full garden redesign, we're all ears.",
        variableName: "service_needed",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "How would you describe the size of your garden? (e.g., Small, Medium, or Large?)",
        variableName: "garden_size",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's the postcode or area for the garden?",
        variableName: "postcode",
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
        text: "Great. And what's your name?",
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
        text: "What's the best phone number for us to get in touch about your quote?",
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
        text: "When would you like us to come by for a free assessment of your space?",
        variableName: "visit_preference",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Excellent! 🌳 I've passed your info to the team. They'll be in touch shortly to arrange a visit and provide a free, no-obligation quote.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 7,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["landscaping-lead", "quote-request"],
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
  name: "Handyman & Repair: Job Booking",
  description:
    "Quickly captures job description, urgency, address, and contact info for fast dispatch or scheduling.",
  category: "handyman",
  icon: "🔧",
  group: "Home Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🔧 Got something that needs fixing? You're in the right place.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell me a bit about the job that needs doing. The more detail the better!",
        variableName: "job_description",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Is this something urgent, or are you happy to schedule it for a convenient time?",
        variableName: "urgency",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's the postcode or address where the work needs to be done?",
        variableName: "job_address",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Got it. And what's your name?",
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
        text: "What's the best phone number for us to call or text you with a quote?",
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
        text: "Got it! 🛠️ We'll take a look at the job and be in touch very shortly with our availability and pricing. Speak soon!",
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
        tags: ["handyman-job", "repair-request"],
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
  name: "Pet Care: Booking & Service Enquiry",
  description:
    "For dog walkers, groomers, boarders, and pet sitters. Captures pet details, service dates, and owner contact.",
  category: "pet-care",
  icon: "🐾",
  group: "Personal Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🐾 Welcome. We'd love to help look after your furry family members.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What can we help you with? Whether it's dog walking, grooming, or some overnight boarding, we're ready to help.",
        variableName: "pet_service",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "Tell us a bit about your pet! What kind of animal are they, and what's their name?",
        variableName: "pet_details",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "When were you thinking you'd need our help? Let us know the dates or how often you're looking for.",
        variableName: "service_dates",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Lovely. And who should we get in touch with?",
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
        text: "What's the best phone number to reach you on for a quick chat?",
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
        text: "Paw-some! 🐶 We've got your info. We'll be in touch very soon to confirm everything and answer any questions you have. Can't wait to meet you and {{pet_details}}!",
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
        tags: ["pet-care-enquiry", "service-booking"],
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
  name: "Child & Elder Care: Service Enquiry",
  description:
    "Sensitively captures care type, recipient details, schedule needs, and contact info for childcare or eldercare.",
  category: "care-services",
  icon: "💙",
  group: "Personal Services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hello! 👋 Thank you for reaching out. We're here to help you find the most compassionate and professional care for your family. Take your time.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1400,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What kind of care are you looking for? Whether it's childcare, support for an elder, or a bit of respite care, we're here to listen.",
        variableName: "care_type",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "If you're comfortable sharing, could you tell us a bit about who the care is for and any specific needs they might have?",
        variableName: "care_recipient",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What kind of schedule are you hoping for? We're very flexible.",
        variableName: "care_schedule",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 800,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Thank you. And who should we ask for when we follow up?",
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
        text: "What's the best phone number for us to reach you on for a sensitive chat about your needs?",
        variableName: "contact_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Thank you for sharing that with us. 💙 One of our care coordinators will be in touch personally very soon to discuss how we can best support your family.",
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
        tags: ["care-enquiry", "new-family"],
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
  name: "Restaurant: Table Booking & Enquiries",
  description:
    "Handle reservations, dietary needs, and menu requests. Perfect for any dining establishment.",
  category: "restaurant",
  icon: "🍴",
  group: "Hospitality & Leisure",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hello! 🍴 Welcome to our restaurant. We're excited to have you dine with us.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "How can I help you today? Would you like to book a table, see our latest menu, or do you have a question about our location?",
        variableName: "restaurant_request",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "restaurant_request",
            operator: "contains",
            value: "book",
            nextNodeOrder: 3,
          },
          {
            variableName: "restaurant_request",
            operator: "contains",
            value: "reserv",
            nextNodeOrder: 3,
          },
          {
            variableName: "restaurant_request",
            operator: "contains",
            value: "table",
            nextNodeOrder: 3,
          },
          {
            variableName: "restaurant_request",
            operator: "contains",
            value: "menu",
            nextNodeOrder: 10,
          },
        ],
        nextNodeOrder: 11,
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
        text: "Got it. Are there any dietary requirements or special occasions we should know about? 🎂",
        variableName: "dietary_requests",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 900,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "Perfect. And what's your name so we can put the booking under?",
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
        text: "And finally, what's the best phone number to send your confirmation to?",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
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
        text: "You can find our latest seasonal menu right here: [MENU_URL] 🥗 Hope you find something you love!",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
        nextNodeOrder: 13,
      },
      order: 11,
    },
    // Other/Location Path
    {
      type: "message",
      content: {
        text: "No problem. If you leave your question and a way to reach you, one of our team will get back to you personally. We're located at [LOCATION_ADDRESS]. 📍",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 13,
      },
      order: 12,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: 13,
    },
  ],
};

export const HOTEL_TEMPLATE: FlowTemplateDefinition = {
  name: "Hotel: Reservations & Guest Services",
  description:
    "Manage room bookings and amenity enquiries with an elegant, helpful flow for guests.",
  category: "hotel",
  icon: "🏨",
  group: "Hospitality & Leisure",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏨 We're delighted you're considering a stay with us. How can we make your visit perfect?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Would you like to book a room, or are you looking for information about our amenities or check-in times?",
        variableName: "hotel_request",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "hotel_request",
            operator: "contains",
            value: "book",
            nextNodeOrder: 3,
          },
          {
            variableName: "hotel_request",
            operator: "contains",
            value: "reserv",
            nextNodeOrder: 3,
          },
          {
            variableName: "hotel_request",
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
        text: "Excellent! 🛌 What dates were you thinking of, and for how many guests?",
        variableName: "stay_details",
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
        text: "And what's your full name, please?",
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
        text: "What's the best email to send your reservation options to?",
        variableName: "customer_email",
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
        text: "Perfect. 🥂 Our reservations team will check our availability and send your options to {{customer_email}} shortly. We look forward to welcoming you!",
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
        tags: ["hotel-booking", "reservation-enquiry"],
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
        text: "Of course. You can find all about our spa, gym, and dining at [AMENITIES_URL]. 🧖 Check-in is from 3pm and check-out is by 11am. Let us know if you have any other questions!",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1300,
        nextNodeOrder: 11,
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

export const GOLF_CLUB_TEMPLATE: FlowTemplateDefinition = {
  name: "Golf Club: Tee Times & Membership",
  description:
    "Book tee times, manage membership enquiries, and share pro shop info effortlessly.",
  category: "golf-club",
  icon: "⛳",
  group: "Hospitality & Leisure",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome to the club! ⛳ We're looking forward to seeing you on the green.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "How can we help you today? Would you like to book a tee time, enquire about membership, or find out about our pro shop?",
        variableName: "golf_request",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 1,
    },
    {
      type: "condition",
      content: {
        conditions: [
          {
            variableName: "golf_request",
            operator: "contains",
            value: "tee",
            nextNodeOrder: 3,
          },
          {
            variableName: "golf_request",
            operator: "contains",
            value: "book",
            nextNodeOrder: 3,
          },
          {
            variableName: "golf_request",
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
        text: "Great! 🏌️ What date and time were you hoping for, and for how many players?",
        variableName: "tee_time_details",
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
        text: "And what's your name, please?",
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
        text: "What's the best phone number for us to confirm your tee time?",
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
        text: "Perfect! 🏆 We'll check the course schedule and get back to you shortly to confirm. Happy golfing!",
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
        tags: ["golf-booking", "tee-time-request"],
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
        text: "We'd love to have you as a member! 🤝 You can find all our membership tiers and benefits here: [MEMBERSHIP_URL]. Let us know if you'd like a tour of the clubhouse!",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1300,
        nextNodeOrder: 12,
      },
      order: 10,
    },
    // Other/Pro Shop Path
    {
      type: "message",
      content: {
        text: "No problem. If you leave your question and a way to reach you, one of our team will get back to you personally. Our pro shop is open daily from 7am. 🛍️",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1200,
        nextNodeOrder: 12,
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
