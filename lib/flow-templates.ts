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
  | "care-services";

export interface FlowTemplateDefinition {
  name: string;
  description: string;
  category: FlowTemplateCategory;
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
    "A universal entry flow that greets visitors, captures their intent, and routes them to pricing, booking, or support paths.",
  category: "welcome",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey there! 👋 Welcome. I can help with pricing, services, bookings, or connecting you with the team.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What would you like help with today?",
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
        text: "Great choice! 💰 Please share your name and email and our team will send the right package options your way.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Perfect. 📅 Tell me your preferred date or time window and we will follow up with availability.",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "No problem at all. Please leave your question and the best contact detail, and we will get back to you shortly. 🙌",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 5,
    },
  ],
};

export const LEAD_GENERATION_TEMPLATE: FlowTemplateDefinition = {
  name: "Lead Generation: Qualification Funnel",
  description:
    "Captures contact details, budget, timeline, and intent for inbound campaigns. Tags qualified leads automatically.",
  category: "lead-generation",
  nodes: [
    {
      type: "message",
      content: {
        text: "Thanks for reaching out! 👋 I can help you get a fast quote or connect you directly with our sales team.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your full name?",
        variableName: "lead_name",
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
        text: "And the best email address to follow up on?",
        variableName: "lead_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's your phone number?",
        variableName: "lead_phone",
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
        text: "What are you looking for help with?",
        variableName: "lead_need",
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
        text: "What budget range are you working with?",
        variableName: "lead_budget",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "What's your ideal timeline to get started?",
        variableName: "lead_timeline",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Perfect. ✅ Your details are captured and our team will follow up shortly with the best next step for you.",
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
        tags: ["lead", "qualified", "new-inquiry"],
      },
      order: 8,
    },
  ],
};

export const LEAD_CAPTURE_TEMPLATE: FlowTemplateDefinition = {
  name: "Lead Capture: Quick Contact Micro-Flow",
  description:
    "A minimal 5-step micro-flow for fast lead capture. Collect name, email, phone, and one qualifying question. Ideal as an entry point for any business.",
  category: "lead-capture",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 👋 I just need a few quick details so the right person can follow up with you.",
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
        text: "What's your email address?",
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
        text: "Best phone number to reach you?",
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
        text: "What can we help you with? (One sentence is fine.)",
        variableName: "contact_reason",
        inputType: "text",
        delayMs: 300,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks so much! 🙏 We'll be in touch very soon.",
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
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL / B2B TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const REAL_ESTATE_TEMPLATE: FlowTemplateDefinition = {
  name: "Real Estate: Buyer & Seller Leads",
  description:
    "Designed for estate agents and property teams. Qualifies buyer, seller, or rental intent and captures follow-up details.",
  category: "real-estate",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome to our property team! 🏡 Are you looking to buy, sell, rent, or book a viewing?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell me your goal in a few words.",
        variableName: "property_goal",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
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
        text: "Great. Please share your property postcode and best callback number and we'll arrange a free valuation. 📞",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Perfect. Share your target area, bedroom count, and budget and an agent will send matching options. 🏘️",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks. Share your preferred area, move-in date, and monthly budget and we'll recommend the best rentals available. 🔑",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Share the property you're interested in and the best way to reach you, and we'll arrange the next step. 📋",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 6,
    },
  ],
};

export const SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Services: Qualification & Booking",
  description:
    "Perfect for service providers (consulting, plumbing, IT support). Qualifies leads and captures booking requests.",
  category: "services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! 👋 We can help with new projects, urgent requests, or routine maintenance.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What do you need help with?",
        variableName: "service_description",
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
        text: "Is this urgent, or can it be scheduled?",
        variableName: "urgency",
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
        text: "What's your name?",
        variableName: "customer_name",
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
        text: "What's the best contact number to reach you?",
        variableName: "phone_number",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Perfect. ✅ Our team will review your request and follow up shortly with the next step.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["service-request", "new-enquiry"],
      },
      order: 6,
    },
  ],
};

export const AGENCIES_TEMPLATE: FlowTemplateDefinition = {
  name: "Agencies: Project Discovery",
  description:
    "Designed for agencies (marketing, digital, design). Discovers project scope, budget, and timeline before connecting with a human.",
  category: "agencies",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🚀 Let's get a quick outline of your project so the right strategist can follow up.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell us briefly about your project goals.",
        variableName: "project_brief",
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
        text: "What's your approximate budget range?",
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
        text: "What's your timeline for this project?",
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
        text: "What's the best email to send you a proposal?",
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
        text: "Perfect. 🎯 A strategist will review your brief and follow up with tailored next steps.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
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
  ],
};

export const BOOKING_TEMPLATE: FlowTemplateDefinition = {
  name: "Booking: Appointments & Reservations",
  description:
    "Ideal for booking-heavy businesses (salons, gyms, restaurants, clinics). Confirms service and collects booking details.",
  category: "booking",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 📅 We'd love to help you book. Tell us what service or appointment you need.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service are you interested in?",
        variableName: "service_type",
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
        text: "What's your name?",
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
        text: "What's your phone number?",
        variableName: "phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "What date or time works best for you?",
        variableName: "preferred_time",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks! ✅ Your booking request is received and our team will confirm availability shortly.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 5,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["booking-request", "new-appointment"],
      },
      order: 6,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FITNESS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const BOUTIQUE_GYM_TEMPLATE: FlowTemplateDefinition = {
  name: "Boutique Gym: Membership Enquiry",
  description:
    "Designed for boutique gyms. Qualifies new membership, class, or tour enquiries and captures contact details for follow-up.",
  category: "boutique-gym",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 💪 Welcome to our gym. Are you interested in joining, booking a class, or just want to know more?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What brings you here? (e.g. new membership, trial class, pricing, gym tour)",
        variableName: "gym_interest",
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
        text: "What's your fitness goal right now?",
        variableName: "fitness_goal",
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
        text: "What's your name?",
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
        text: "Best phone number to reach you?",
        variableName: "member_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What days or times work best for you to train?",
        variableName: "preferred_schedule",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Awesome! 🙌 We'll reach out shortly to get you started. We can't wait to have you with us!",
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
        tags: ["gym-lead", "membership-enquiry"],
      },
      order: 7,
    },
  ],
};

export const PERSONAL_TRAINING_TEMPLATE: FlowTemplateDefinition = {
  name: "Personal Training: Client Intake",
  description:
    "For personal trainers and PT studios. Captures fitness goals, experience level, and scheduling preferences before the first session.",
  category: "personal-training",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🏋️ I'm here to help you reach your fitness goals. Let's find out how I can best support you.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your main fitness goal? (e.g. weight loss, muscle gain, general fitness, sport performance)",
        variableName: "fitness_goal",
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
        text: "How would you describe your current fitness level? (beginner, intermediate, advanced)",
        variableName: "fitness_level",
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
        text: "Do you have any injuries or health conditions I should know about?",
        variableName: "health_notes",
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
        text: "What's your name?",
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
        text: "What's your phone number?",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "What days or times are you usually free to train?",
        variableName: "availability",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Amazing! 💥 I'll review your details and get back to you with a personalised plan and session options.",
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
  ],
};

export const CROSSFIT_GYM_TEMPLATE: FlowTemplateDefinition = {
  name: "CrossFit Gym: Trial & Membership",
  description:
    "Built for CrossFit boxes. Warms up new visitors, assesses experience, and drives them toward a free trial class or membership.",
  category: "crossfit-gym",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 🔥 Welcome to the box. Thinking about joining or trying your first class?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Have you done CrossFit before, or would this be your first time?",
        variableName: "cf_experience",
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
        text: "What's your main goal? (e.g. get fit, lose weight, compete, build strength)",
        variableName: "cf_goal",
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
        text: "What's your name?",
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
        text: "What's your email address?",
        variableName: "athlete_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "When would you like to come in for a free intro session?",
        variableName: "intro_date",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Let's go! 🏆 We'll confirm your intro session shortly. See you at the box!",
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
        tags: ["crossfit-lead", "trial-request"],
      },
      order: 7,
    },
  ],
};

export const BOOT_CAMP_TEMPLATE: FlowTemplateDefinition = {
  name: "Boot Camp: Programme Enquiry",
  description:
    "For outdoor and indoor boot camp programmes. Captures fitness level, programme interest, and contact details for follow-up.",
  category: "boot-camp",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🏃 Ready to get fit? Tell me a bit about what you're looking for.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Which programme interests you? (e.g. morning boot camp, weight loss, HIIT, outdoor fitness)",
        variableName: "programme_interest",
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
        text: "How would you describe your current fitness level? (beginner, intermediate, advanced)",
        variableName: "fitness_level",
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
        text: "What's your name?",
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
        text: "Best phone number to reach you?",
        variableName: "participant_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Brilliant! 💪 We'll be in touch shortly with available sessions and how to get started.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
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
  ],
};

export const YOGA_STUDIO_TEMPLATE: FlowTemplateDefinition = {
  name: "Yoga Studio: Class Booking & Membership",
  description:
    "For yoga studios and wellness spaces. Captures class preferences, experience level, and contact details to confirm bookings.",
  category: "yoga-studio",
  nodes: [
    {
      type: "message",
      content: {
        text: "Namaste! 🧘 Welcome. Are you interested in joining a class, starting a membership, or finding out more?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What type of yoga or class are you interested in? (e.g. Hatha, Vinyasa, Yin, Prenatal, Meditation)",
        variableName: "class_preference",
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
        text: "What's your yoga experience level? (complete beginner, some experience, regular practitioner)",
        variableName: "yoga_experience",
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
        text: "What's your name?",
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
        text: "What's your email address?",
        variableName: "student_email",
        inputType: "email",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What days and times work best for you?",
        variableName: "preferred_schedule",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Wonderful! 🌿 We'll send you available class times and next steps to get you on the mat.",
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
        tags: ["yoga-enquiry", "class-booking"],
      },
      order: 7,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BEAUTY & WELLNESS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const HAIR_SALON_TEMPLATE: FlowTemplateDefinition = {
  name: "Hair Salon: Booking & Service Enquiry",
  description:
    "For hair salons and stylists. Captures service type, preferred stylist, and booking details to confirm appointments.",
  category: "hair-salon",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi there! ✂️ Welcome. We'd love to help you look and feel your best. What can we do for you?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service are you looking for? (e.g. cut, colour, highlights, blowdry, treatment)",
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
        text: "Do you have a preferred stylist, or are you happy for us to assign one?",
        variableName: "stylist_preference",
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
        text: "What's your name?",
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
        text: "What's your phone number?",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What date and time would you prefer?",
        variableName: "preferred_datetime",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Lovely! 💇 We'll confirm your appointment and send any details you need beforehand.",
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
        tags: ["salon-booking", "hair-appointment"],
      },
      order: 7,
    },
  ],
};

export const BARBERSHOP_TEMPLATE: FlowTemplateDefinition = {
  name: "Barbershop: Appointment Booking",
  description:
    "For barbershops and men's grooming studios. Captures service, barber preference, and booking time quickly.",
  category: "barbershop",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hey! 💈 Welcome. What can we get done for you today?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service do you need? (e.g. haircut, beard trim, hot shave, fade, combo)",
        variableName: "service_type",
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
        text: "Do you have a preferred barber?",
        variableName: "barber_preference",
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
        text: "What's your name?",
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
        text: "What's your phone number?",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
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
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Sorted! ✅ We'll confirm your slot shortly. See you at the chair!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 900,
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
  ],
};

export const DAY_SPA_TEMPLATE: FlowTemplateDefinition = {
  name: "Day Spa: Treatment Booking",
  description:
    "For day spas and wellness retreats. Captures treatment preference, date, and special requests to confirm bookings.",
  category: "day-spa",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome! 🌸 We're delighted to help you relax and recharge. What kind of experience are you looking for?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1300,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Which treatment interests you? (e.g. massage, facial, body wrap, manicure, spa day package)",
        variableName: "treatment_type",
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
        text: "Is this for yourself or for a gift or group booking?",
        variableName: "booking_for",
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
        text: "What's your name?",
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
        text: "What's your phone number?",
        variableName: "guest_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What date and time would you prefer?",
        variableName: "preferred_datetime",
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
        text: "Any allergies, preferences, or special requests we should know about?",
        variableName: "special_requests",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 700,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Wonderful! 🛁 Your booking request is received. We'll confirm your appointment and send everything you need to know.",
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
        tags: ["spa-booking", "treatment-enquiry"],
      },
      order: 8,
    },
  ],
};

export const NAIL_SALON_TEMPLATE: FlowTemplateDefinition = {
  name: "Nail Salon: Appointment Booking",
  description:
    "For nail salons and nail technicians. Quickly captures service type, preferred time, and contact details to confirm appointments.",
  category: "nail-salon",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 💅 Welcome. Let's get you booked in for some gorgeous nails. What are you after?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service would you like? (e.g. gel manicure, acrylic nails, pedicure, nail art, infills)",
        variableName: "nail_service",
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
        text: "What's your name?",
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
        text: "What's your phone number?",
        variableName: "client_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "When would you like to come in?",
        variableName: "preferred_time",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Fabulous! 💖 We'll confirm your appointment shortly. Can't wait to see you!",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
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
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HOME SERVICES TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const CLEANING_SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Cleaning Services: Quote & Booking",
  description:
    "For residential and commercial cleaning businesses. Qualifies property type, service scope, and captures contact details for a quote.",
  category: "cleaning-services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🧹 We'd love to help keep your space spotless. Let's get a few details to prepare your quote.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Is this for a residential or commercial property?",
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
        text: "What type of clean do you need? (e.g. regular weekly, one-off deep clean, end of tenancy, office clean)",
        variableName: "clean_type",
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
        text: "How many bedrooms or rooms does the property have?",
        variableName: "property_size",
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
        text: "What's your postcode or area?",
        variableName: "postcode",
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
        text: "What's your name?",
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
        text: "Best phone number to reach you?",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 6,
    },
    {
      type: "input",
      content: {
        text: "When would you like the clean to take place?",
        variableName: "preferred_date",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 7,
    },
    {
      type: "message",
      content: {
        text: "Perfect! ✨ We'll prepare your quote and be in touch shortly to confirm everything.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
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
  ],
};

export const LANDSCAPING_TEMPLATE: FlowTemplateDefinition = {
  name: "Landscaping & Gardening: Quote Request",
  description:
    "For landscapers and gardening services. Captures job type, property details, and contact info to prepare a site visit or quote.",
  category: "landscaping",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🌿 Thanks for getting in touch. Let's see how we can transform your outdoor space.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service do you need? (e.g. lawn care, garden design, patio/decking, tree surgery, maintenance)",
        variableName: "service_needed",
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
        text: "How would you describe the size of your garden or outdoor space? (small, medium, large)",
        variableName: "garden_size",
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
        text: "What's your postcode or area?",
        variableName: "postcode",
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
        text: "What's your name?",
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
        text: "Best phone number to reach you?",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "input",
      content: {
        text: "When would you like us to visit for a free assessment?",
        variableName: "visit_preference",
        inputType: "text",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 6,
    },
    {
      type: "message",
      content: {
        text: "Excellent! 🌳 We'll be in touch to arrange your site visit and provide a free no-obligation quote.",
        delayMs: 600,
        typingEnabled: true,
        typingDurationMs: 1000,
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
  ],
};

export const HANDYMAN_TEMPLATE: FlowTemplateDefinition = {
  name: "Handyman & Repair: Job Booking",
  description:
    "For handymen and repair services. Quickly captures job description, urgency, location, and contact info for fast response.",
  category: "handyman",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🔧 Tell me what needs fixing and we'll get someone to you fast.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What needs to be done? (Describe the job briefly)",
        variableName: "job_description",
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
        text: "Is this urgent or can it be scheduled for a convenient time?",
        variableName: "urgency",
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
        text: "What's your postcode or address?",
        variableName: "job_address",
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
        text: "What's your name?",
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
        text: "Best number to call or text you on?",
        variableName: "customer_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Got it! 🛠️ We'll review your job and be in touch very shortly with availability and pricing.",
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
        tags: ["handyman-job", "repair-request"],
      },
      order: 7,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL SERVICES TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const PET_CARE_TEMPLATE: FlowTemplateDefinition = {
  name: "Pet Care: Booking & Service Enquiry",
  description:
    "For dog walkers, groomers, pet sitters, and boarding services. Captures pet details, service needed, and owner contact info.",
  category: "pet-care",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hi! 🐾 Welcome. We'd love to look after your furry friend. What do you need?",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1100,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What service are you looking for? (e.g. dog walking, grooming, overnight boarding, pet sitting, daycare)",
        variableName: "pet_service",
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
        text: "What type of pet do you have, and what's their name?",
        variableName: "pet_details",
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
        text: "What dates do you need the service? (or how often, e.g. Mon/Wed/Fri walks)",
        variableName: "service_dates",
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
        text: "What's your name?",
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
        text: "Best phone number to reach you?",
        variableName: "owner_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Paw-some! 🐶 We'll be in touch very soon to confirm everything and answer any questions.",
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
        tags: ["pet-care-enquiry", "service-booking"],
      },
      order: 7,
    },
  ],
};

export const CARE_SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Child & Elder Care: Service Enquiry",
  description:
    "For childcare, eldercare, and respite care providers. Captures care type, schedule needs, and contact details sensitively.",
  category: "care-services",
  nodes: [
    {
      type: "message",
      content: {
        text: "Hello! 👋 Thank you for reaching out. We're here to help with compassionate, professional care. Please take your time.",
        delayMs: 0,
        typingEnabled: true,
        typingDurationMs: 1400,
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What type of care are you enquiring about? (e.g. childcare, after-school care, eldercare, respite care, overnight care)",
        variableName: "care_type",
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
        text: "Can you tell us a little about who the care is for? (e.g. age range, any specific needs)",
        variableName: "care_recipient",
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
        text: "What schedule are you looking for? (e.g. full-time, part-time, mornings only, weekends)",
        variableName: "care_schedule",
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
        text: "What's your name?",
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
        text: "Best phone number to reach you?",
        variableName: "contact_phone",
        inputType: "phone",
        delayMs: 400,
        typingEnabled: true,
        typingDurationMs: 600,
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Thank you so much for sharing. 💙 One of our care coordinators will be in touch soon to discuss the right support for your family.",
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
        tags: ["care-enquiry", "new-family"],
      },
      order: 7,
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
  ];
}

export function getTemplateByCategory(
  category: FlowTemplateCategory,
): FlowTemplateDefinition | undefined {
  const templates = getAvailableTemplates();
  return templates.find((t) => t.category === category);
}
