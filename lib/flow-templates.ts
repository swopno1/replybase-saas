/**
 * Starter Template Definitions for Flow Builder
 */

export type FlowTemplateCategory =
  | "welcome"
  | "lead-generation"
  | "real-estate"
  | "services"
  | "agencies"
  | "booking";

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

export const WELCOME_TEMPLATE: FlowTemplateDefinition = {
  name: "Welcome Flow: Triage & Routing",
  description:
    "A simple universal welcome flow that greets visitors, captures intent, and routes them into the right next step.",
  category: "welcome",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome. I can help with pricing, services, bookings, or connecting you with the team.",
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What would you like help with today?",
        variableName: "last_request",
        inputType: "text",
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
        text: "We can absolutely help with pricing. Please share your name and email, and our team will send the right package options.",
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Great. Tell me your preferred date or time window and we will follow up with availability.",
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks. Please leave your question and the best contact detail, and we will get back to you shortly.",
      },
      order: 5,
    },
  ],
};

export const LEAD_GENERATION_TEMPLATE: FlowTemplateDefinition = {
  name: "Lead Generation: Qualification Funnel",
  description:
    "Captures contact details, budget, timeline, and intent for general lead generation campaigns.",
  category: "lead-generation",
  nodes: [
    {
      type: "message",
      content: {
        text: "Thanks for reaching out. I can help you get a fast quote or connect you with our sales team.",
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your full name?",
        variableName: "lead_name",
        inputType: "text",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's the best email address for follow-up?",
        variableName: "lead_email",
        inputType: "email",
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's your phone number?",
        variableName: "lead_phone",
        inputType: "phone",
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "What are you looking for help with?",
        variableName: "lead_need",
        inputType: "text",
      },
      order: 4,
    },
    {
      type: "input",
      content: {
        text: "What budget range are you working with?",
        variableName: "lead_budget",
        inputType: "text",
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Perfect. Your details are captured and our team will follow up shortly with the best next step.",
      },
      order: 6,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["lead", "new-inquiry"],
      },
      order: 7,
    },
  ],
};

export const REAL_ESTATE_TEMPLATE: FlowTemplateDefinition = {
  name: "Real Estate: Buyer & Seller Leads",
  description:
    "Designed for estate agents and property teams. Qualifies buyer, seller, or rental intent and captures follow-up details.",
  category: "real-estate",
  nodes: [
    {
      type: "message",
      content: {
        text: "Welcome to our property team. Are you looking to buy, sell, rent, or book a viewing?",
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell me your goal in a few words.",
        variableName: "property_goal",
        inputType: "text",
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
        text: "Great. Please share your property postcode and best callback number for a valuation.",
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Perfect. Please share your target area, bedroom count, and budget, and an agent will send matching options.",
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Thanks. Please share your preferred area, move-in date, and monthly budget, and we will recommend suitable rentals.",
      },
      order: 5,
    },
    {
      type: "message",
      content: {
        text: "Please share the property you are interested in and the best way to reach you, and we will arrange the next step.",
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
        text: "Welcome. We can help with new work, urgent requests, or routine maintenance.",
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What do you need help with?",
        variableName: "service_description",
        inputType: "text",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's the best contact number to reach you?",
        variableName: "phone_number",
        inputType: "phone",
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "Perfect. Our team will review your request and follow up shortly with the next step.",
      },
      order: 3,
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
        text: "Welcome to our agency. Let's get a quick outline of your project so the right strategist can follow up.",
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Tell us briefly about your project goals.",
        variableName: "project_brief",
        inputType: "text",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's your approximate budget range?",
        variableName: "budget_range",
        inputType: "text",
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's your timeline for this project?",
        variableName: "timeline",
        inputType: "text",
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "What's the best email to send you a proposal?",
        variableName: "email",
        inputType: "email",
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "Perfect. A strategist will review your brief and follow up with next steps.",
      },
      order: 5,
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
        text: "We'd love to help you book. Tell us what service or appointment you need.",
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "What's your name?",
        variableName: "name",
        inputType: "text",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's your phone number?",
        variableName: "phone",
        inputType: "phone",
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What date or time works best for you?",
        variableName: "preferred_time",
        inputType: "text",
      },
      order: 3,
    },
    {
      type: "message",
      content: {
        text: "Thanks. Your booking request is received and our team will confirm availability shortly.",
      },
      order: 4,
    },
  ],
};

export function getAvailableTemplates(): FlowTemplateDefinition[] {
  return [
    WELCOME_TEMPLATE,
    LEAD_GENERATION_TEMPLATE,
    REAL_ESTATE_TEMPLATE,
    SERVICES_TEMPLATE,
    AGENCIES_TEMPLATE,
    BOOKING_TEMPLATE,
  ];
}

export function getTemplateByCategory(
  category: FlowTemplateCategory,
): FlowTemplateDefinition | undefined {
  const templates = getAvailableTemplates();
  return templates.find((t) => t.category === category);
}
