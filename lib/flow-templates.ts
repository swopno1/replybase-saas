/**
 * Vertical Template Definitions for Flow Builder
 * These are pre-built flow templates for common business use cases
 */

export interface FlowTemplateDefinition {
  name: string;
  description: string;
  category: "services" | "agencies" | "booking";
  nodes: Array<{
    type: string;
    content: Record<string, unknown>;
    order: number;
  }>;
}

/**
 * Services: Consultants, plumbers, IT support, etc.
 * Flow: Welcome → Service Inquiry → Qualification → Booking/Quote Request
 */
export const SERVICES_TEMPLATE: FlowTemplateDefinition = {
  name: "Services: Qualification & Booking",
  description:
    "Perfect for service providers (consulting, plumbing, IT support). Qualifies leads and captures booking requests.",
  category: "services",
  nodes: [
    {
      type: "message",
      content: {
        text: "👋 Welcome! We're here to help you with your service needs.\n\nWhat service are you interested in?",
        buttons: [
          {
            type: "postback",
            title: "General Inquiry",
            payload: "inquiry_general",
          },
          {
            type: "postback",
            title: "Emergency Service",
            payload: "inquiry_emergency",
          },
          {
            type: "postback",
            title: "Maintenance",
            payload: "inquiry_maintenance",
          },
        ],
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Thanks for reaching out! Could you briefly describe the issue or what you need help with?",
        variableName: "service_description",
        inputType: "text",
        validationMessage:
          "Please provide a brief description (at least 10 characters)",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's the best contact number to reach you?",
        variableName: "phone_number",
        inputType: "phone",
        validationMessage: "Please provide a valid phone number",
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "Perfect! Here's what happens next:\n\n✅ Our team will review your request\n📧 You'll receive a quote within 24 hours\n📱 We'll call you to confirm details\n\nAny questions in the meantime?",
        buttons: [
          {
            type: "postback",
            title: "No, I'm all set",
            payload: "end_inquiry",
          },
          {
            type: "postback",
            title: "Yes, I have a question",
            payload: "question",
          },
        ],
      },
      order: 3,
    },
  ],
};

/**
 * Agencies: Digital agencies, marketing agencies
 * Flow: Welcome → Service Selection → Project Brief → Budget/Timeline → Call CTA
 */
export const AGENCIES_TEMPLATE: FlowTemplateDefinition = {
  name: "Agencies: Project Discovery",
  description:
    "Designed for agencies (marketing, digital, design). Discovers project scope, budget, and timeline before connecting with a human.",
  category: "agencies",
  nodes: [
    {
      type: "message",
      content: {
        text: "👏 Welcome to our agency!\n\nWe work with amazing brands to grow their presence online. Let's explore how we can help you.\n\nWhat service are you most interested in?",
        buttons: [
          {
            type: "postback",
            title: "Website Design",
            payload: "service_design",
          },
          {
            type: "postback",
            title: "Digital Marketing",
            payload: "service_marketing",
          },
          {
            type: "postback",
            title: "Content Strategy",
            payload: "service_content",
          },
          {
            type: "postback",
            title: "Brand Strategy",
            payload: "service_brand",
          },
        ],
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Great! Tell us briefly about your project goals.",
        variableName: "project_brief",
        inputType: "text",
        validationMessage:
          "Please provide project details (at least 20 characters)",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "What's your approximate budget range?",
        variableName: "budget_range",
        inputType: "text",
        validationMessage: "Please enter a budget range (e.g., £5k-£10k)",
      },
      order: 2,
    },
    {
      type: "input",
      content: {
        text: "What's your timeline for this project?",
        variableName: "timeline",
        inputType: "text",
        validationMessage: "Please specify a timeline",
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Finally, what's the best email to send you a proposal?",
        variableName: "email",
        inputType: "email",
        validationMessage: "Please provide a valid email address",
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "🎉 Perfect! Here's what happens next:\n\n📋 Our team will review your project\n📞 A strategist will reach out within 24 hours\n💡 We'll discuss next steps and timeline\n\nWe're excited to work with you!",
        buttons: [
          {
            type: "postback",
            title: "Schedule a Call",
            payload: "schedule_call",
          },
          {
            type: "postback",
            title: "Done for now",
            payload: "end_discovery",
          },
        ],
      },
      order: 5,
    },
  ],
};

/**
 * Booking: Salons, gyms, restaurants, clinics
 * Flow: Welcome → Service Selection → Date/Time → Confirmation
 */
export const BOOKING_TEMPLATE: FlowTemplateDefinition = {
  name: "Booking: Appointments & Reservations",
  description:
    "Ideal for booking-heavy businesses (salons, gyms, restaurants, clinics). Confirms service, collects contact info, suggests available times.",
  category: "booking",
  nodes: [
    {
      type: "message",
      content: {
        text: "📅 Welcome! We'd love to have you visit us.\n\nWhat service would you like to book?",
        buttons: [
          {
            type: "postback",
            title: "Hair Cut",
            payload: "service_haircut",
          },
          {
            type: "postback",
            title: "Massage",
            payload: "service_massage",
          },
          {
            type: "postback",
            title: "Consultation",
            payload: "service_consultation",
          },
          {
            type: "postback",
            title: "Other",
            payload: "service_other",
          },
        ],
      },
      order: 0,
    },
    {
      type: "input",
      content: {
        text: "Great! What's your name?",
        variableName: "name",
        inputType: "text",
        validationMessage: "Please provide your name",
      },
      order: 1,
    },
    {
      type: "input",
      content: {
        text: "And your phone number? (so we can send you a confirmation)",
        variableName: "phone",
        inputType: "phone",
        validationMessage: "Please provide a valid phone number",
      },
      order: 2,
    },
    {
      type: "message",
      content: {
        text: "Perfect! Our team will reach out shortly with available times.\n\n📞 We'll call you or send a confirmation message.\n\nIs there anything else you'd like us to know?",
        buttons: [
          {
            type: "postback",
            title: "Yes, add notes",
            payload: "add_notes",
          },
          {
            type: "postback",
            title: "No, that's all",
            payload: "confirm_booking",
          },
        ],
      },
      order: 3,
    },
    {
      type: "input",
      content: {
        text: "Please share any special requests or notes for your appointment:",
        variableName: "notes",
        inputType: "text",
        validationMessage: "Notes recorded",
      },
      order: 4,
    },
    {
      type: "message",
      content: {
        text: "✅ Your booking request is confirmed!\n\n🙌 Thanks for choosing us. We'll be in touch soon!",
        buttons: [] as never[],
      },
      order: 5,
    },
  ],
};

/**
 * Get all available templates
 */
export function getAvailableTemplates(): FlowTemplateDefinition[] {
  return [SERVICES_TEMPLATE, AGENCIES_TEMPLATE, BOOKING_TEMPLATE];
}

/**
 * Get template by category
 */
export function getTemplateByCategory(
  category: "services" | "agencies" | "booking",
): FlowTemplateDefinition | undefined {
  const templates = getAvailableTemplates();
  return templates.find((t) => t.category === category);
}
