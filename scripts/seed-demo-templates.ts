import { prisma } from "@/lib/prisma";

async function seedDemoTemplates() {
  console.log("Seeding demo templates...");

  const templates = [
    {
      name: "lead_generation_ecommerce",
      displayName: "E-commerce Lead Generator",
      description:
        "Capture leads and qualify shoppers for your e-commerce store",
      businessType: "ecommerce",
      category: "engagement",
      icon: "🛍️",
      order: 1,
      flowJson: {
        blocks: [
          {
            id: "welcome",
            type: "text",
            content: "Hi! 👋 Looking for something special today?",
            nextBlockId: "collect_interest",
          },
          {
            id: "collect_interest",
            type: "choice",
            content: "What brings you here?",
            choices: [
              {
                label: "Browse products",
                value: "browse",
                nextBlockId: "show_catalog",
              },
              {
                label: "Track my order",
                value: "track",
                nextBlockId: "track_order",
              },
              {
                label: "Get help",
                value: "help",
                nextBlockId: "customer_support",
              },
            ],
          },
          {
            id: "show_catalog",
            type: "text",
            content: "Great! Check out our latest collection at [WEBSITE_URL]",
            nextBlockId: "collect_email",
          },
          {
            id: "collect_email",
            type: "input",
            content: "Want 10% off your first order? Share your email!",
            nextBlockId: "thank_you",
          },
          {
            id: "thank_you",
            type: "text",
            content: "🎉 Done! Check your inbox for the discount code.",
          },
        ],
      },
    },
    {
      name: "customer_support_service",
      displayName: "Service Business Support",
      description: "Handle customer inquiries and appointment booking",
      businessType: "service",
      category: "support",
      icon: "💼",
      order: 2,
      flowJson: {
        blocks: [
          {
            id: "welcome",
            type: "text",
            content: "Welcome! How can we help you today?",
            nextBlockId: "service_type",
          },
          {
            id: "service_type",
            type: "choice",
            content: "What would you like to do?",
            choices: [
              {
                label: "Book appointment",
                value: "book",
                nextBlockId: "collect_details",
              },
              {
                label: "Get a quote",
                value: "quote",
                nextBlockId: "quote_form",
              },
              {
                label: "Talk to support",
                value: "support",
                nextBlockId: "transfer_agent",
              },
            ],
          },
          {
            id: "collect_details",
            type: "input",
            content: "Perfect! What's your preferred date and time?",
            nextBlockId: "collect_contact",
          },
          {
            id: "collect_contact",
            type: "input",
            content: "Great! Please share your phone number so we can confirm.",
            nextBlockId: "confirmation",
          },
          {
            id: "confirmation",
            type: "text",
            content:
              "✅ Your appointment is requested! We'll call you within 24 hours.",
          },
        ],
      },
    },
    {
      name: "product_qualification_saas",
      displayName: "SaaS Product Qualifier",
      description: "Qualify leads and schedule product demos",
      businessType: "saas",
      category: "qualification",
      icon: "🚀",
      order: 3,
      flowJson: {
        blocks: [
          {
            id: "welcome",
            type: "text",
            content: "Hi! 👋 Interested in [PRODUCT_NAME]?",
            nextBlockId: "company_size",
          },
          {
            id: "company_size",
            type: "choice",
            content: "What's your company size?",
            choices: [
              {
                label: "1-10 employees",
                value: "small",
                nextBlockId: "use_case",
              },
              {
                label: "11-50 employees",
                value: "medium",
                nextBlockId: "use_case",
              },
              {
                label: "51+ employees",
                value: "large",
                nextBlockId: "use_case",
              },
            ],
          },
          {
            id: "use_case",
            type: "input",
            content: "What problem are you trying to solve?",
            nextBlockId: "schedule_demo",
          },
          {
            id: "schedule_demo",
            type: "choice",
            content: "Want to see it in action?",
            choices: [
              {
                label: "Schedule demo",
                value: "yes",
                nextBlockId: "collect_email",
              },
              { label: "Send me info", value: "no", nextBlockId: "send_info" },
            ],
          },
          {
            id: "collect_email",
            type: "input",
            content: "Great! What's your work email?",
            nextBlockId: "thank_you_demo",
          },
          {
            id: "thank_you_demo",
            type: "text",
            content:
              "🎉 Perfect! Our team will reach out within 1 business day to schedule.",
          },
        ],
      },
    },
    {
      name: "lead_nurture_agency",
      displayName: "Agency Lead Nurture",
      description: "Nurture leads and showcase agency services",
      businessType: "agency",
      category: "nurture",
      icon: "🤝",
      order: 4,
      flowJson: {
        blocks: [
          {
            id: "welcome",
            type: "text",
            content: "Welcome! 🎨 Looking for marketing help?",
            nextBlockId: "service_interest",
          },
          {
            id: "service_interest",
            type: "choice",
            content: "Which service interests you?",
            choices: [
              {
                label: "Social Media",
                value: "social",
                nextBlockId: "budget_range",
              },
              {
                label: "SEO & Content",
                value: "seo",
                nextBlockId: "budget_range",
              },
              { label: "Paid Ads", value: "ads", nextBlockId: "budget_range" },
              {
                label: "Full Package",
                value: "full",
                nextBlockId: "budget_range",
              },
            ],
          },
          {
            id: "budget_range",
            type: "choice",
            content: "What's your monthly budget?",
            choices: [
              { label: "£1K-£5K", value: "tier1", nextBlockId: "collect_info" },
              {
                label: "£5K-£10K",
                value: "tier2",
                nextBlockId: "collect_info",
              },
              { label: "£10K+", value: "tier3", nextBlockId: "collect_info" },
            ],
          },
          {
            id: "collect_info",
            type: "input",
            content:
              "Perfect! Share your email and we'll send a custom proposal.",
            nextBlockId: "follow_up",
          },
          {
            id: "follow_up",
            type: "text",
            content:
              "✨ Great! Expect a tailored proposal in your inbox within 48 hours.",
          },
        ],
      },
    },
    {
      name: "appointment_booking",
      displayName: "Appointment Booking Assistant",
      description: "Schedule appointments and manage bookings",
      businessType: "service",
      category: "booking",
      icon: "📅",
      order: 5,
      flowJson: {
        blocks: [
          {
            id: "welcome",
            type: "text",
            content: "Hi! Ready to book an appointment? 📅",
            nextBlockId: "service_select",
          },
          {
            id: "service_select",
            type: "choice",
            content: "What service do you need?",
            choices: [
              {
                label: "Consultation",
                value: "consult",
                nextBlockId: "date_time",
              },
              {
                label: "Follow-up",
                value: "followup",
                nextBlockId: "date_time",
              },
              {
                label: "Emergency",
                value: "emergency",
                nextBlockId: "urgent_contact",
              },
            ],
          },
          {
            id: "date_time",
            type: "input",
            content: "When works best for you? (e.g., Tomorrow at 2pm)",
            nextBlockId: "contact_details",
          },
          {
            id: "contact_details",
            type: "input",
            content: "Please share your phone number for confirmation.",
            nextBlockId: "booking_confirmation",
          },
          {
            id: "booking_confirmation",
            type: "text",
            content:
              "✅ Appointment requested! You'll receive a confirmation call shortly.",
          },
        ],
      },
    },
    {
      name: "faq_assistant",
      displayName: "FAQ & Support Assistant",
      description: "Answer common questions and route to support",
      businessType: "other",
      category: "support",
      icon: "💡",
      order: 6,
      flowJson: {
        blocks: [
          {
            id: "welcome",
            type: "text",
            content: "Hi! I'm here to help. What can I answer for you?",
            nextBlockId: "topic_select",
          },
          {
            id: "topic_select",
            type: "choice",
            content: "Choose a topic:",
            choices: [
              {
                label: "Pricing",
                value: "pricing",
                nextBlockId: "pricing_info",
              },
              {
                label: "How it works",
                value: "howto",
                nextBlockId: "howto_info",
              },
              {
                label: "Contact support",
                value: "support",
                nextBlockId: "transfer",
              },
            ],
          },
          {
            id: "pricing_info",
            type: "text",
            content:
              "Our plans start at £29/month. Visit [PRICING_URL] for details!",
            nextBlockId: "helpful",
          },
          {
            id: "helpful",
            type: "choice",
            content: "Was this helpful?",
            choices: [
              { label: "Yes, thanks!", value: "yes", nextBlockId: "goodbye" },
              { label: "Need more help", value: "no", nextBlockId: "transfer" },
            ],
          },
          {
            id: "goodbye",
            type: "text",
            content: "Great! Feel free to reach out anytime. 😊",
          },
        ],
      },
    },
  ];

  for (const template of templates) {
    await prisma.demoTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
  }

  console.log(`✅ Seeded ${templates.length} demo templates`);
}

async function main() {
  try {
    await seedDemoTemplates();
    console.log("✅ Demo templates seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding demo templates:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
