/**
 * Seed ReplyBase Orchestra Flows for replybase1@gmail.com
 *
 * Creates the full Orchestra System flow set — a 4-layer psychological framework
 * for lead-gen conversations across all channels:
 *
 *   flow_Initial             — Orchestrator entry flow ("Aria" bot)
 *   flow_lead-generation     — Primary lead capture (highest priority)
 *   flow_pricing-discussion  — Pricing overview + plan comparison
 *   flow_features-discussion — Feature exploration
 *   flow_contact             — Contact details + callback capture
 *   flow_tutorial            — Quick-start guide
 *
 * Usage:
 *   cd replybase-saas && dotenv -- tsx scripts/seed-orchestra-flows.ts
 */

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NodeContent = Record<string, unknown>;

type NodeInput = {
  type: string;
  content: NodeContent;
  order: number;
};

type FlowSpec = {
  name: string;
  description: string;
  fallbackMessage: string;
  nodes: NodeInput[];
};

// ─── Helper: upsert a flow (create or replace nodes) ─────────────────────────

async function upsertFlow(tenantId: string, ownerId: string, spec: FlowSpec) {
  const nodes = spec.nodes.map((n) => ({
    type: n.type,
    order: n.order,
    content: JSON.parse(JSON.stringify(n.content)) as Prisma.InputJsonValue,
  }));

  const existing = await prisma.flow.findFirst({
    where: { tenantId, name: spec.name },
  });

  if (existing) {
    return prisma.flow.update({
      where: { id: existing.id },
      data: {
        description: spec.description,
        ownerId,
        isActive: true,
        language: "en",
        fallbackMessage: spec.fallbackMessage,
        nodes: { deleteMany: {}, create: nodes },
      },
      include: { nodes: { orderBy: { order: "asc" } } },
    });
  }

  return prisma.flow.create({
    data: {
      name: spec.name,
      description: spec.description,
      tenantId,
      ownerId,
      isGlobal: false,
      isActive: true,
      language: "en",
      fallbackMessage: spec.fallbackMessage,
      nodes: { create: nodes },
    },
    include: { nodes: { orderBy: { order: "asc" } } },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1: flow_lead-generation
// Priority: HIGHEST — must work perfectly on every channel.
// Collects: name, email, phone, business type, volume, budget.
// Tags the lead and updates status to "qualified".
// ─────────────────────────────────────────────────────────────────────────────

const LEAD_GEN_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "To make sure I'm pointing you in the right direction, I'd love to learn a bit about you and your setup. It'll only take a minute! 😊",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 300,
    },
    order: 0,
  },
  {
    type: "input",
    content: {
      text: "First things first — what's your name?",
      variableName: "lead_name",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 800,
      delayMs: 500,
    },
    order: 1,
  },
  {
    type: "message",
    content: {
      text: "Nice to meet you, {{lead_name}}! 👋",
      typingEnabled: true,
      typingDurationMs: 700,
      delayMs: 300,
    },
    order: 2,
  },
  {
    type: "input",
    content: {
      text: "What's the best email address to reach you on?",
      variableName: "lead_email",
      inputType: "email",
      typingEnabled: true,
      typingDurationMs: 800,
      delayMs: 400,
    },
    order: 3,
  },
  {
    type: "input",
    content: {
      text: "And a phone number? (Totally optional — only if you're happy for us to call.)",
      variableName: "lead_phone",
      inputType: "phone",
      typingEnabled: true,
      typingDurationMs: 900,
      delayMs: 400,
    },
    order: 4,
  },
  {
    type: "input",
    content: {
      text: "What kind of business are you running? (e.g. e-commerce, SaaS, agency, professional services...)",
      variableName: "lead_business_type",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1000,
      delayMs: 400,
    },
    order: 5,
  },
  {
    type: "input",
    content: {
      text: "How many customer conversations does your team handle roughly per week?",
      variableName: "lead_volume",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1000,
      delayMs: 400,
    },
    order: 6,
  },
  {
    type: "input",
    content: {
      text: "And finally — what's your rough monthly budget for tools like this? (e.g. under £50, £50–£100, £100–£250, or no limit)",
      variableName: "lead_budget",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1100,
      delayMs: 500,
    },
    order: 7,
  },
  {
    type: "message",
    content: {
      text: "That's super helpful, {{lead_name}}! 🎉 Based on what you've shared, we'll put together a personalised recommendation. Our team will reach out to {{lead_email}} within 1 business day.",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 600,
    },
    order: 8,
  },
  {
    // Tag the lead for CRM segmentation
    type: "action",
    content: {
      action: "tag_user",
      tags: ["lead", "qualified", "new-lead"],
    },
    order: 9,
  },
  {
    // Update status — also triggers lead persistence in webchat engine
    type: "action",
    content: {
      action: "update_status",
      status: "qualified",
    },
    order: 10,
  },
  {
    // End sub-flow and resume parent (if called from flow_Initial)
    type: "action",
    content: {
      action: "end_flow",
    },
    order: 11,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2: flow_pricing-discussion
// Covers all four plans with individual detail nodes.
// Converges at order 20 for the sign-up CTA.
// ─────────────────────────────────────────────────────────────────────────────

const PRICING_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Great question on pricing! ReplyBase is designed to scale with you — there's a plan whether you're testing the waters or running a high-volume operation. 💸",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Here's a quick overview of our plans:\n\n🆓 Free — £0/month\n• 150 AI responses/month\n• 250 automations\n• 1 bot, Webchat only\n• Great for testing!\n\n🚀 Starter — £29/month\n• 1,000 AI responses\n• 1,500 automations\n• 3 bots, all channels\n• Email + chat support\n\n⚡ Pro — £89/month\n• 7,500 AI responses\n• 10,000 automations\n• 10 bots + advanced analytics\n• Priority support\n\n🏢 Business — £249/month\n• Unlimited everything\n• Custom integrations\n• Dedicated account manager\n• SLA + phone support",
      typingEnabled: true,
      typingDurationMs: 2000,
      delayMs: 800,
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "Which plan sounds closest to what you need? Type Free, Starter, Pro, or Business — or just tell me what you're looking for! 😊",
      variableName: "pricing_interest",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1100,
      delayMs: 600,
    },
    order: 2,
  },
  {
    type: "condition",
    content: {
      conditions: [
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "free",
          nextNodeOrder: 10,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "starter",
          nextNodeOrder: 11,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "pro",
          nextNodeOrder: 12,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "business",
          nextNodeOrder: 13,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "enterprise",
          nextNodeOrder: 13,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "custom",
          nextNodeOrder: 13,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "249",
          nextNodeOrder: 13,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "89",
          nextNodeOrder: 12,
        },
        {
          variableName: "pricing_interest",
          operator: "contains",
          value: "29",
          nextNodeOrder: 11,
        },
      ],
      nextNodeOrder: 14,
    },
    order: 3,
  },
  // ── Free plan detail (→ 20)
  {
    type: "message",
    content: {
      text: "The Free plan is the perfect low-risk starting point! You get:\n✅ 150 AI-powered responses/month\n✅ 250 flow automations\n✅ 1 active bot on Webchat\n✅ Full access to the Flow Builder\n✅ CRM & lead management\n\nNo credit card needed — sign up and you're live in minutes. 🎉",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 10,
  },
  // ── Starter detail (→ 20)
  {
    type: "message",
    content: {
      text: "The Starter plan is a fan favourite for growing businesses! 🚀\n✅ 1,000 AI responses/month\n✅ 1,500 automations/month\n✅ 3 active bots\n✅ All channels: Webchat, WhatsApp, Facebook & Telegram\n✅ CRM + lead management\n✅ Email & chat support\n\nJust £29/month — less than a coffee a day!",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 11,
  },
  // ── Pro detail (→ 20)
  {
    type: "message",
    content: {
      text: "The Pro plan is built for teams that mean business! ⚡\n✅ 7,500 AI responses/month\n✅ 10,000 automations/month\n✅ 10 active bots\n✅ Advanced analytics & custom reporting\n✅ API access for integrations\n✅ Priority support with 4-hour response time\n\nAt £89/month, it's the best value for scaling operations.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 12,
  },
  // ── Business/Enterprise detail (→ 20)
  {
    type: "message",
    content: {
      text: "The Business plan is for organisations that need it all! 🏢\n✅ Unlimited AI responses\n✅ Unlimited automations & bots\n✅ Custom channel integrations\n✅ Dedicated account manager\n✅ Onboarding & training sessions\n✅ SLA guarantee + phone support\n✅ White-label options available\n\nAt £249/month — and we also offer custom enterprise pricing for large teams.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 13,
  },
  // ── Default: browse all (→ 20)
  {
    type: "message",
    content: {
      text: "No worries! You can compare all plans side by side at:\n👉 https://replybase.co.uk/pricing\n\nThe page has a full feature matrix so you can see exactly what each tier includes.",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 14,
  },
  // ── CTA (converge point from all branches above)
  {
    type: "message",
    content: {
      text: "Ready to get started? You can sign up for free — no card required:\n👉 https://app.replybase.co.uk\n\nOr if you'd like to talk through options with our team, just ask and I'll get you connected! 😊",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 700,
    },
    order: 20,
  },
  {
    type: "action",
    content: {
      action: "tag_user",
      tags: ["pricing-interest"],
    },
    order: 21,
  },
  {
    type: "action",
    content: {
      action: "end_flow",
    },
    order: 22,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3: flow_features-discussion
// Covers: multi-channel, flow builder, AI, CRM, analytics, integrations.
// Branches by keyword, all converge at order 20 for CTA.
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Absolutely — let me walk you through what makes ReplyBase different from the crowd! 🔍",
      typingEnabled: true,
      typingDurationMs: 1200,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Here's a quick overview of what's under the hood:\n\n📡 Multi-Channel — Webchat, WhatsApp, Facebook, Telegram in one inbox\n🔧 Flow Builder — No-code visual conversation designer\n🧠 AI Intent Engine — Understands what customers really mean\n👥 CRM & Lead Management — Auto-capture, tag, and qualify leads\n📊 Analytics & Reporting — See what's working and what isn't\n🔗 Integrations — Connect with your existing tools via API\n🤖 Custom Bots — Personalise persona, tone, and branding",
      typingEnabled: true,
      typingDurationMs: 1800,
      delayMs: 700,
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "Which of those sounds most relevant to you? (e.g. channels, automation, AI, CRM, analytics, integrations)",
      variableName: "feature_interest",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1000,
      delayMs: 600,
    },
    order: 2,
  },
  {
    type: "condition",
    content: {
      conditions: [
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "channel",
          nextNodeOrder: 10,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "whatsapp",
          nextNodeOrder: 10,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "facebook",
          nextNodeOrder: 10,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "telegram",
          nextNodeOrder: 10,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "multi",
          nextNodeOrder: 10,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "flow",
          nextNodeOrder: 11,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "automat",
          nextNodeOrder: 11,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "bot",
          nextNodeOrder: 11,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "builder",
          nextNodeOrder: 11,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "no-code",
          nextNodeOrder: 11,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "ai",
          nextNodeOrder: 12,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "smart",
          nextNodeOrder: 12,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "intent",
          nextNodeOrder: 12,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "intellig",
          nextNodeOrder: 12,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "crm",
          nextNodeOrder: 13,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "lead",
          nextNodeOrder: 13,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "contact",
          nextNodeOrder: 13,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "analytic",
          nextNodeOrder: 14,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "report",
          nextNodeOrder: 14,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "insight",
          nextNodeOrder: 14,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "integrat",
          nextNodeOrder: 15,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "api",
          nextNodeOrder: 15,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "webhook",
          nextNodeOrder: 15,
        },
        {
          variableName: "feature_interest",
          operator: "contains",
          value: "zapier",
          nextNodeOrder: 15,
        },
      ],
      nextNodeOrder: 16,
    },
    order: 3,
  },
  // ── Multi-channel (→ 20)
  {
    type: "message",
    content: {
      text: "Our multi-channel support is one of our biggest differentiators! 📡\n\nWith ReplyBase, you manage ALL your conversations from one unified inbox:\n• 💬 Webchat (embed on any website with one line of code)\n• 📱 WhatsApp Business\n• 📘 Facebook Messenger\n• ✈️ Telegram\n\nSame flows, same CRM, same analytics — just different entry points. Set it up once and you're everywhere your customers are.",
      typingEnabled: true,
      typingDurationMs: 1700,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 10,
  },
  // ── Flow Builder (→ 20)
  {
    type: "message",
    content: {
      text: "The Flow Builder is where the magic happens! 🔧\n\nIt's a no-code, visual editor where you design conversation paths:\n• Message nodes — send text with typing effects\n• Input nodes — capture any information you need\n• Condition nodes — branch based on responses\n• Action nodes — tag leads, update CRM, call sub-flows\n• Delay & typing indicators — make every response feel truly human\n\nMost customers have their first working bot live within 30 minutes.",
      typingEnabled: true,
      typingDurationMs: 1700,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 11,
  },
  // ── AI (→ 20)
  {
    type: "message",
    content: {
      text: "The AI Intent Engine is what sets ReplyBase apart from simple rule-based chatbots! 🧠\n\nInstead of requiring exact keyword matches, our AI understands the *intent* behind what your customer says — even when they phrase it differently every time.\n\nThis means:\n• Higher flow completion rates\n• Less frustration for your customers\n• Smarter routing to the right conversation path\n• Continuous improvement with every interaction",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 12,
  },
  // ── CRM (→ 20)
  {
    type: "message",
    content: {
      text: "Our built-in CRM means you don't need a separate tool for lead management! 👥\n\nEvery conversation automatically creates a contact record with:\n• Name, email, phone — captured from your flows\n• Full conversation history\n• Custom tags (e.g. 'hot-lead', 'pricing-interest')\n• Lead status tracking: new → qualified → converted\n• Source attribution (which channel, which flow)\n\nYou can also sync to your existing CRM via API.",
      typingEnabled: true,
      typingDurationMs: 1700,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 13,
  },
  // ── Analytics (→ 20)
  {
    type: "message",
    content: {
      text: "Analytics & reporting give you full visibility into what's working! 📊\n\nYou'll see:\n• Flow completion rates (spot exactly where people drop off)\n• Lead conversion metrics by channel\n• Response time tracking\n• Top-performing conversation paths\n• Channel performance comparison\n\nOn Pro and Business plans, you get advanced dashboards with custom date ranges and export options.",
      typingEnabled: true,
      typingDurationMs: 1700,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 14,
  },
  // ── Integrations/API (→ 20)
  {
    type: "message",
    content: {
      text: "Our API & integrations layer connects ReplyBase to your existing stack! 🔗\n\nSupported integrations:\n• Zapier (1,000+ apps with no code)\n• Webhooks (real-time data push)\n• REST API (full programmatic access)\n• CSV/JSON lead exports\n\nCommon use cases: syncing leads to HubSpot, triggering Slack notifications, updating your e-commerce platform, or firing off email campaigns automatically.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 15,
  },
  // ── Default: all features summary (→ 20)
  {
    type: "message",
    content: {
      text: "Our full feature breakdown is available at:\n👉 https://replybase.co.uk\n\nOr if you'd like a live demo where I walk you through everything — just say 'demo' and I'll arrange it with our team!",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 500,
      nextNodeOrder: 20,
    },
    order: 16,
  },
  // ── CTA (converge point)
  {
    type: "message",
    content: {
      text: "Want to see it all in action? Start free — no card required:\n👉 https://app.replybase.co.uk\n\nOr ask me for a personalised demo and I'll sort it for you! 🎯",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 600,
    },
    order: 20,
  },
  {
    type: "action",
    content: {
      action: "tag_user",
      tags: ["features-interest"],
    },
    order: 21,
  },
  {
    type: "action",
    content: {
      action: "end_flow",
    },
    order: 22,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 4: flow_contact
// Shows contact details, offers callback capture.
// "Yes" path: captures email → tags → end.
// "No" path: links to contact page → end.
// ─────────────────────────────────────────────────────────────────────────────

const CONTACT_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Happy to connect you with the right person! 📞",
      typingEnabled: true,
      typingDurationMs: 900,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Here's how to reach us:\n\n📧 Email: admin@replybase.co.uk\n🌐 Contact form: https://replybase.co.uk/contact\n💬 Live chat: Available on our website (9am–5pm GMT, Mon–Fri)\n\nWe typically respond within a few hours on business days.",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 600,
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "Would you like us to reach out to you directly? (yes / no)",
      variableName: "contact_callback",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 900,
      delayMs: 500,
    },
    order: 2,
  },
  {
    type: "condition",
    content: {
      conditions: [
        {
          variableName: "contact_callback",
          operator: "contains",
          value: "yes",
          nextNodeOrder: 10,
        },
        {
          variableName: "contact_callback",
          operator: "contains",
          value: "yeah",
          nextNodeOrder: 10,
        },
        {
          variableName: "contact_callback",
          operator: "contains",
          value: "sure",
          nextNodeOrder: 10,
        },
        {
          variableName: "contact_callback",
          operator: "contains",
          value: "please",
          nextNodeOrder: 10,
        },
        {
          variableName: "contact_callback",
          operator: "contains",
          value: "ok",
          nextNodeOrder: 10,
        },
      ],
      nextNodeOrder: 15,
    },
    order: 3,
  },
  // ── Callback requested (10 → 11 → 12 → 13)
  {
    type: "input",
    content: {
      text: "Great! What's the best email address for us to reach you on?",
      variableName: "callback_email",
      inputType: "email",
      typingEnabled: true,
      typingDurationMs: 900,
      delayMs: 400,
    },
    order: 10,
  },
  {
    type: "message",
    content: {
      text: "Perfect! We'll be in touch at {{callback_email}} within 1 business day. Looking forward to chatting with you! 🤝",
      typingEnabled: true,
      typingDurationMs: 1200,
      delayMs: 400,
    },
    order: 11,
  },
  {
    type: "action",
    content: {
      action: "tag_user",
      tags: ["callback-requested", "lead"],
    },
    order: 12,
  },
  {
    type: "action",
    content: {
      action: "end_flow",
    },
    order: 13,
  },
  // ── No callback (15 → 16)
  {
    type: "message",
    content: {
      text: "No problem at all! Our contact page is always open:\n👉 https://replybase.co.uk/contact\n\nDon't hesitate to reach out whenever you're ready. 😊",
      typingEnabled: true,
      typingDurationMs: 1200,
      delayMs: 400,
    },
    order: 15,
  },
  {
    type: "action",
    content: {
      action: "end_flow",
    },
    order: 16,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 5: flow_tutorial
// Four-step quick-start guide.
// ─────────────────────────────────────────────────────────────────────────────

const TUTORIAL_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Let me walk you through how to get started with ReplyBase — it's simpler than you might think! 🚀",
      typingEnabled: true,
      typingDurationMs: 1200,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "✅ Step 1: Create your account\n\nHead to https://app.replybase.co.uk and sign up for free. No credit card needed — your account is ready in under 60 seconds.",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 800,
    },
    order: 1,
  },
  {
    type: "message",
    content: {
      text: "✅ Step 2: Connect your channels\n\nIn the dashboard, go to Settings → Channels and connect whichever you need: Webchat, WhatsApp, Facebook, or Telegram. The Webchat embed is just a one-line script — done in seconds.",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 900,
    },
    order: 2,
  },
  {
    type: "message",
    content: {
      text: "✅ Step 3: Build your first flow\n\nGo to Flows → Create New, pick a template (or start from scratch), and use the visual editor to design your conversation. Add message nodes, input nodes, conditions, and actions — all drag and drop.",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 900,
    },
    order: 3,
  },
  {
    type: "message",
    content: {
      text: "✅ Step 4: Activate and go live!\n\nOnce you're happy with your flow, hit Activate. Your bot instantly starts responding to visitors on your connected channels. That's it — you're live! 🎉",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 900,
    },
    order: 4,
  },
  {
    type: "message",
    content: {
      text: "📚 For deeper guides and walkthroughs, check out our documentation:\n👉 https://replybase.co.uk/docs\n\nAnd if you ever get stuck, our support team is always here to help — just ask! 💪",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 700,
    },
    order: 5,
  },
  {
    type: "action",
    content: {
      action: "tag_user",
      tags: ["tutorial-viewed"],
    },
    order: 6,
  },
  {
    type: "action",
    content: {
      action: "end_flow",
    },
    order: 7,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 6: flow_Initial (The Orchestra Orchestrator — "Aria")
//
// Entry flow for all channels. Routes based on intent:
//   price/cost/plan       → flow_pricing-discussion   (order 10–11)
//   feature/how/demo      → flow_features-discussion  (order 20–21)
//   contact/help/support  → flow_contact              (order 30–31)
//   guide/tutorial/start  → flow_tutorial             (order 40–41)
//   default               → flow_lead-generation      (order 50–51)
//
// All paths converge at order 60 for the follow-up question.
// Follow-up routes to sub-flows or closes gracefully at order 80+.
// ─────────────────────────────────────────────────────────────────────────────

function buildInitialNodes(flowIdsByName: Record<string, string>): NodeInput[] {
  return [
    // ── Entry & introduction
    {
      type: "message",
      content: {
        text: "Hey there! 👋 I'm Aria — your ReplyBase assistant. I'm here to help you discover how ReplyBase can transform your customer conversations.",
        typingEnabled: true,
        typingDurationMs: 1600,
        delayMs: 0,
      },
      order: 0,
    },
    {
      type: "message",
      content: {
        text: "Whether you're curious about features, pricing, getting started, or just want to say hi — I've got you covered! 😊",
        typingEnabled: true,
        typingDurationMs: 1300,
        delayMs: 800,
      },
      order: 1,
    },
    // ── Intent capture
    {
      type: "input",
      content: {
        text: "What brings you here today?",
        variableName: "initial_intent",
        inputType: "text",
        typingEnabled: true,
        typingDurationMs: 800,
        delayMs: 500,
      },
      order: 2,
    },
    // ── Intent routing condition
    {
      type: "condition",
      content: {
        conditions: [
          // Pricing intent
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "price",
            nextNodeOrder: 10,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "cost",
            nextNodeOrder: 10,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "plan",
            nextNodeOrder: 10,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "much",
            nextNodeOrder: 10,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "paid",
            nextNodeOrder: 10,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "subscript",
            nextNodeOrder: 10,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "tier",
            nextNodeOrder: 10,
          },
          // Features intent
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "feature",
            nextNodeOrder: 20,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "how",
            nextNodeOrder: 20,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "demo",
            nextNodeOrder: 20,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "work",
            nextNodeOrder: 20,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "capabilit",
            nextNodeOrder: 20,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "do you",
            nextNodeOrder: 20,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "what can",
            nextNodeOrder: 20,
          },
          // Contact / human intent
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "contact",
            nextNodeOrder: 30,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "help",
            nextNodeOrder: 30,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "support",
            nextNodeOrder: 30,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "talk",
            nextNodeOrder: 30,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "human",
            nextNodeOrder: 30,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "person",
            nextNodeOrder: 30,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "team",
            nextNodeOrder: 30,
          },
          // Tutorial / getting started intent
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "guide",
            nextNodeOrder: 40,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "tutorial",
            nextNodeOrder: 40,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "start",
            nextNodeOrder: 40,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "setup",
            nextNodeOrder: 40,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "begin",
            nextNodeOrder: 40,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "onboard",
            nextNodeOrder: 40,
          },
          {
            variableName: "initial_intent",
            operator: "contains",
            value: "get started",
            nextNodeOrder: 40,
          },
        ],
        nextNodeOrder: 50, // Default → lead gen
      },
      order: 3,
    },

    // ── Branch A: Pricing (10 → 11)
    {
      type: "message",
      content: {
        text: "Love it — let me pull up our pricing for you! 💰",
        typingEnabled: true,
        typingDurationMs: 900,
        delayMs: 300,
      },
      order: 10,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_pricing-discussion",
        targetFlowId: flowIdsByName["flow_pricing-discussion"] ?? "",
        nextNodeOrder: 60,
      },
      order: 11,
    },

    // ── Branch B: Features (20 → 21)
    {
      type: "message",
      content: {
        text: "Great question! Let me walk you through what makes ReplyBase tick. 🔍",
        typingEnabled: true,
        typingDurationMs: 1000,
        delayMs: 300,
      },
      order: 20,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_features-discussion",
        targetFlowId: flowIdsByName["flow_features-discussion"] ?? "",
        nextNodeOrder: 60,
      },
      order: 21,
    },

    // ── Branch C: Contact (30 → 31)
    {
      type: "message",
      content: {
        text: "Of course! Let me get you our contact details right away. 📞",
        typingEnabled: true,
        typingDurationMs: 900,
        delayMs: 300,
      },
      order: 30,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_contact",
        targetFlowId: flowIdsByName["flow_contact"] ?? "",
        nextNodeOrder: 60,
      },
      order: 31,
    },

    // ── Branch D: Tutorial (40 → 41)
    {
      type: "message",
      content: {
        text: "Happy to guide you through getting started — it's easier than you think! 🚀",
        typingEnabled: true,
        typingDurationMs: 1000,
        delayMs: 300,
      },
      order: 40,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_tutorial",
        targetFlowId: flowIdsByName["flow_tutorial"] ?? "",
        nextNodeOrder: 60,
      },
      order: 41,
    },

    // ── Default / Lead-gen path (50 → 51)
    {
      type: "message",
      content: {
        text: "To point you in the right direction, I'd love to understand your situation a bit better first. Mind if I ask a few quick questions? 😊",
        typingEnabled: true,
        typingDurationMs: 1300,
        delayMs: 400,
      },
      order: 50,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_lead-generation",
        targetFlowId: flowIdsByName["flow_lead-generation"] ?? "",
        nextNodeOrder: 60,
      },
      order: 51,
    },

    // ── Wrap-up & follow-up (60 → 61 → 62 → 63/64/65/80)
    {
      type: "message",
      content: {
        text: "Is there anything else I can help you with today? 😊",
        typingEnabled: true,
        typingDurationMs: 900,
        delayMs: 600,
      },
      order: 60,
    },
    {
      type: "input",
      content: {
        text: "Feel free to ask, or just say 'no thanks' to wrap up!",
        variableName: "followup_need",
        inputType: "text",
        typingEnabled: true,
        typingDurationMs: 700,
        delayMs: 300,
      },
      order: 61,
    },
    {
      type: "condition",
      content: {
        conditions: [
          // Pricing follow-up
          {
            variableName: "followup_need",
            operator: "contains",
            value: "price",
            nextNodeOrder: 63,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "cost",
            nextNodeOrder: 63,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "plan",
            nextNodeOrder: 63,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "subscript",
            nextNodeOrder: 63,
          },
          // Features follow-up
          {
            variableName: "followup_need",
            operator: "contains",
            value: "feature",
            nextNodeOrder: 64,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "how",
            nextNodeOrder: 64,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "demo",
            nextNodeOrder: 64,
          },
          // Contact follow-up
          {
            variableName: "followup_need",
            operator: "contains",
            value: "contact",
            nextNodeOrder: 65,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "help",
            nextNodeOrder: 65,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "support",
            nextNodeOrder: 65,
          },
          // Graceful close
          {
            variableName: "followup_need",
            operator: "contains",
            value: "no",
            nextNodeOrder: 80,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "done",
            nextNodeOrder: 80,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "thanks",
            nextNodeOrder: 80,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "thank",
            nextNodeOrder: 80,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "bye",
            nextNodeOrder: 80,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "nothing",
            nextNodeOrder: 80,
          },
          {
            variableName: "followup_need",
            operator: "contains",
            value: "all good",
            nextNodeOrder: 80,
          },
        ],
        nextNodeOrder: 80,
      },
      order: 62,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_pricing-discussion",
        targetFlowId: flowIdsByName["flow_pricing-discussion"] ?? "",
        nextNodeOrder: 80,
      },
      order: 63,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_features-discussion",
        targetFlowId: flowIdsByName["flow_features-discussion"] ?? "",
        nextNodeOrder: 80,
      },
      order: 64,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_contact",
        targetFlowId: flowIdsByName["flow_contact"] ?? "",
        nextNodeOrder: 80,
      },
      order: 65,
    },

    // ── Goodbye (80 → 81 → 82 → 83)
    {
      type: "message",
      content: {
        text: "It was a pleasure chatting with you! 🌟 We hope to have you on board soon. If you ever want to continue this conversation, just say hello and I'll be right here.",
        typingEnabled: true,
        typingDurationMs: 1500,
        delayMs: 500,
      },
      order: 80,
    },
    {
      type: "message",
      content: {
        text: "Have a wonderful day — from Aria and the ReplyBase team! 👋",
        typingEnabled: true,
        typingDurationMs: 1000,
        delayMs: 700,
      },
      order: 81,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["initial-flow-completed"],
      },
      order: 82,
    },
    {
      type: "action",
      content: {
        action: "end_flow",
      },
      order: 83,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  try {
    console.log("🎭 Starting Orchestra Flows seeding...\n");

    // 1. Locate the target user
    const user = await prisma.user.findFirst({
      where: { email: "replybase1@gmail.com" },
      select: { id: true, tenantId: true, email: true },
    });

    if (!user?.tenantId) {
      console.error(
        "❌  User replybase1@gmail.com not found or has no tenant.\n" +
          "    Create the account first, then re-run this script.",
      );
      process.exit(1);
    }

    const { id: ownerId, tenantId } = user;
    console.log(`✅  Found user:  ${user.email}`);
    console.log(`    Tenant ID:  ${tenantId}`);
    console.log(`    User ID:    ${ownerId}\n`);

    // 2. Create / update sub-flows first so we have their IDs
    console.log("📋  Creating sub-flows...");

    const leadGenFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_lead-generation",
      description:
        "Primary lead capture — collects name, email, phone, business type, volume, and budget. Tags and qualifies the lead.",
      fallbackMessage: "I didn't quite catch that. Could you try again?",
      nodes: LEAD_GEN_NODES,
    });
    console.log(`    ✅  flow_lead-generation      (${leadGenFlow.id})`);

    const pricingFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_pricing-discussion",
      description:
        "Pricing overview with plan comparison (Free, Starter, Pro, Business) and sign-up CTA.",
      fallbackMessage: "Let me know if you have any questions about our plans!",
      nodes: PRICING_NODES,
    });
    console.log(`    ✅  flow_pricing-discussion   (${pricingFlow.id})`);

    const featuresFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_features-discussion",
      description:
        "Feature exploration covering multi-channel, flow builder, AI, CRM, analytics, and integrations.",
      fallbackMessage: "Feel free to ask about any specific feature!",
      nodes: FEATURES_NODES,
    });
    console.log(`    ✅  flow_features-discussion  (${featuresFlow.id})`);

    const contactFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_contact",
      description:
        "Shares contact details and captures callback email if requested.",
      fallbackMessage: "You can always reach us at admin@replybase.co.uk",
      nodes: CONTACT_NODES,
    });
    console.log(`    ✅  flow_contact              (${contactFlow.id})`);

    const tutorialFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_tutorial",
      description:
        "4-step quick-start guide: create account → connect channels → build flow → go live.",
      fallbackMessage: "Check our docs at replybase.co.uk/docs for more help!",
      nodes: TUTORIAL_NODES,
    });
    console.log(`    ✅  flow_tutorial             (${tutorialFlow.id})\n`);

    // 3. Build flow_Initial with fully-resolved flow IDs
    console.log("🎭  Creating flow_Initial (orchestrator)...");

    const flowIdsByName: Record<string, string> = {
      "flow_lead-generation": leadGenFlow.id,
      "flow_pricing-discussion": pricingFlow.id,
      "flow_features-discussion": featuresFlow.id,
      flow_contact: contactFlow.id,
      flow_tutorial: tutorialFlow.id,
    };

    const initialFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_Initial",
      description:
        "Orchestrator entry flow for all channels. Routes visitors to pricing, features, contact, tutorial, or lead-gen based on intent. Bot persona: Aria.",
      fallbackMessage:
        "Hey! I'm Aria — feel free to ask me anything about ReplyBase. 😊",
      nodes: buildInitialNodes(flowIdsByName),
    });
    console.log(`    ✅  flow_Initial              (${initialFlow.id})\n`);

    // 4. Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉  All Orchestra flows seeded successfully!\n");
    console.log("    Flow IDs:");
    console.log(`      flow_Initial              → ${initialFlow.id}`);
    console.log(`      flow_lead-generation      → ${leadGenFlow.id}`);
    console.log(`      flow_pricing-discussion   → ${pricingFlow.id}`);
    console.log(`      flow_features-discussion  → ${featuresFlow.id}`);
    console.log(`      flow_contact              → ${contactFlow.id}`);
    console.log(`      flow_tutorial             → ${tutorialFlow.id}`);
    console.log("\n    All flows are set to isActive: true.");
    console.log(
      "    Next step: assign flow_Initial to your channels in the dashboard.",
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.error("❌  Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
