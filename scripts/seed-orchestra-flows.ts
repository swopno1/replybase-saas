/**
 * Seed ReplyBase Orchestra Flows for replybase1@gmail.com
 *
 * Wipes all existing flows for the tenant and creates a fresh set:
 *
 *   flow_Initial             — Orchestrator entry ("Aria") — captures lead FIRST, then routes
 *   flow_lead-generation     — Primary lead capture (HIGHEST PRIORITY)
 *   flow_pricing-discussion  — Pricing overview + plan details + sign-up CTA
 *   flow_features-discussion — Feature deep-dive by category
 *   flow_contact             — Contact details + optional callback capture
 *   flow_tutorial            — 4-step getting-started guide
 *
 * Usage:
 *   cd replybase-saas && pnpm seed:orchestra-flows
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


// ─── Helper: delete all flows for a tenant (leaves channels assigned but removes flows) ──
async function deleteAllTenantFlows(tenantId: string) {
  // Fetch all flow IDs for this tenant
  const flows = await prisma.flow.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  if (!flows.length) return;
  console.log(`\n🗑️  Removing ${flows.length} existing flow(s)...`);
  for (const f of flows) {
    await prisma.flow.delete({ where: { id: f.id } });
    console.log(`    Deleted: ${f.name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1 — flow_lead-generation
//
// PRIORITY: HIGHEST. Called as a sub-flow from flow_Initial right after greeting.
// Captures: name, email, phone, business type, weekly volume, budget.
// On completion: tags lead as "qualified" and updates CRM status.
//
// Node order layout (flat sequential, no gaps):
//   0  — warm-up message ("just a few quick things")
//   1  — input: lead_name
//   2  — message: "Nice to meet you, {{lead_name}}"
//   3  — input: lead_email
//   4  — input: lead_phone
//   5  — input: lead_business_type
//   6  — input: lead_volume
//   7  — input: lead_budget
//   8  — message: confirmation + promise
//   9  — action: tag_user (lead, qualified, new-lead)
//  10  — action: update_status (qualified)
//  11  — action: end_flow  ← returns to flow_Initial
// ─────────────────────────────────────────────────────────────────────────────

const LEAD_GEN_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "So I can make sure I'm actually useful to you — mind if I grab a few quick details? Won't take long at all. 😊",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 300,
    },
    order: 0,
  },
  {
    type: "input",
    content: {
      text: "What's your name?",
      variableName: "lead_name",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 700,
      delayMs: 400,
    },
    order: 1,
  },
  {
    type: "message",
    content: {
      text: "Good to meet you, {{lead_name}}! 👋",
      typingEnabled: true,
      typingDurationMs: 600,
      delayMs: 200,
    },
    order: 2,
  },
  {
    type: "input",
    content: {
      text: "What's a good email address for you?",
      variableName: "lead_email",
      inputType: "email",
      typingEnabled: true,
      typingDurationMs: 700,
      delayMs: 300,
    },
    order: 3,
  },
  {
    type: "input",
    content: {
      text: "And a phone number — only if you're happy to share. No worries if not!",
      variableName: "lead_phone",
      inputType: "phone",
      typingEnabled: true,
      typingDurationMs: 900,
      delayMs: 300,
    },
    order: 4,
  },
  {
    type: "input",
    content: {
      text: "What kind of business do you run? (e.g. e-commerce, agency, SaaS, professional services — anything really)",
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
      text: "Roughly how many customer conversations does your team handle per week?",
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
      text: "Last one — what's your rough monthly budget for tools like this? (e.g. under £50, £50–£100, £100–£250, or flexible)",
      variableName: "lead_budget",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1100,
      delayMs: 400,
    },
    order: 7,
  },
  {
    type: "message",
    content: {
      text: "That's really helpful, {{lead_name}} — thank you! 🙌\n\nWe'll look at what you've shared and someone from the team will be in touch at {{lead_email}} within 1 business day. In the meantime, feel free to ask me anything.",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 500,
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
    content: {
      action: "end_flow",
    },
    order: 11,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2 — flow_pricing-discussion
//
// Gives a concise overview then branches per plan. All branches merge at order 20
// for the sign-up CTA. Friendly, conversational, not a sales pitch.
//
//  0  — intro message
//  1  — plan overview (Free / Starter / Pro / Business)
//  2  — input: pricing_interest
//  3  — condition → 10 (Free) | 11 (Starter) | 12 (Pro) | 13 (Business) | 14 (default)
// 10  — Free detail       → nextNodeOrder: 20
// 11  — Starter detail    → nextNodeOrder: 20
// 12  — Pro detail        → nextNodeOrder: 20
// 13  — Business detail   → nextNodeOrder: 20
// 14  — generic link      → nextNodeOrder: 20
// 20  — CTA message
// 21  — action: tag_user (pricing-interest)
// 22  — action: end_flow
// ─────────────────────────────────────────────────────────────────────────────

const PRICING_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Sure — let me walk you through the pricing. We've kept it pretty straightforward, and there's a free plan too so you can try things out before committing. 😊",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Here's the quick summary:\n\n🆓 Free — £0/month\n• 150 AI responses, 250 automations\n• 1 bot on Webchat\n• Great for testing\n\n🚀 Starter — £29/month\n• 1,000 AI responses, 1,500 automations\n• 3 bots across all channels\n• Email + chat support\n\n⚡ Pro — £89/month\n• 7,500 AI responses, 10,000 automations\n• 10 bots, advanced analytics, API access\n• Priority support\n\n🏢 Business — £249/month\n• Unlimited everything\n• Custom integrations, dedicated account manager\n• SLA + phone support",
      typingEnabled: true,
      typingDurationMs: 1800,
      delayMs: 700,
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "Which one catches your eye — or is there something specific you're trying to figure out about the plans?",
      variableName: "pricing_interest",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 1000,
      delayMs: 500,
    },
    order: 2,
  },
  {
    type: "condition",
    content: {
      conditions: [
        { variableName: "pricing_interest", operator: "contains", value: "free", nextNodeOrder: 10 },
        { variableName: "pricing_interest", operator: "contains", value: "trial", nextNodeOrder: 10 },
        { variableName: "pricing_interest", operator: "contains", value: "starter", nextNodeOrder: 11 },
        { variableName: "pricing_interest", operator: "contains", value: "basic", nextNodeOrder: 11 },
        { variableName: "pricing_interest", operator: "contains", value: "29", nextNodeOrder: 11 },
        { variableName: "pricing_interest", operator: "contains", value: "pro", nextNodeOrder: 12 },
        { variableName: "pricing_interest", operator: "contains", value: "89", nextNodeOrder: 12 },
        { variableName: "pricing_interest", operator: "contains", value: "growth", nextNodeOrder: 12 },
        { variableName: "pricing_interest", operator: "contains", value: "business", nextNodeOrder: 13 },
        { variableName: "pricing_interest", operator: "contains", value: "enterprise", nextNodeOrder: 13 },
        { variableName: "pricing_interest", operator: "contains", value: "custom", nextNodeOrder: 13 },
        { variableName: "pricing_interest", operator: "contains", value: "249", nextNodeOrder: 13 },
        { variableName: "pricing_interest", operator: "contains", value: "unlimited", nextNodeOrder: 13 },
      ],
      nextNodeOrder: 14,
    },
    order: 3,
  },
  // ── Free plan detail
  {
    type: "message",
    content: {
      text: "The Free plan is a solid way to see how everything works without any risk.\n\nYou get:\n✔ 150 AI responses/month\n✔ 250 automation runs\n✔ 1 active bot on Webchat\n✔ Full Flow Builder access\n✔ CRM and lead tracking\n\nNo card needed — sign up and you're live in minutes.",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 10,
  },
  // ── Starter plan detail
  {
    type: "message",
    content: {
      text: "Starter is the most popular choice for businesses that are ready to get going properly.\n\nYou get:\n✔ 1,000 AI responses/month\n✔ 1,500 automation runs\n✔ 3 bots across Webchat, WhatsApp, Facebook & Telegram\n✔ CRM + lead management\n✔ Email and chat support\n\nAt £29/month it's very manageable, and you can upgrade anytime.",
      typingEnabled: true,
      typingDurationMs: 1500,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 11,
  },
  // ── Pro plan detail
  {
    type: "message",
    content: {
      text: "Pro is for teams that are scaling and need more headroom.\n\nYou get:\n✔ 7,500 AI responses/month\n✔ 10,000 automation runs\n✔ 10 bots\n✔ Advanced analytics and custom reporting\n✔ API access for integrations\n✔ Priority support (4-hour response)\n\nAt £89/month it covers most growing businesses comfortably.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 12,
  },
  // ── Business plan detail
  {
    type: "message",
    content: {
      text: "Business is the full package — ideal if you're running things at scale or need dedicated support.\n\nYou get:\n✔ Unlimited AI responses and automations\n✔ Unlimited bots\n✔ Custom integrations\n✔ Dedicated account manager\n✔ SLA guarantee and phone support\n✔ Onboarding and training sessions\n\nAt £249/month. We also do custom pricing for larger teams — just ask.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 13,
  },
  // ── Generic / compare all
  {
    type: "message",
    content: {
      text: "You can compare all plans side by side on our pricing page:\n👉 https://replybase.co.uk/pricing\n\nIt has a full feature breakdown so you can see exactly what's included at each level.",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 14,
  },
  // ── CTA (all branches land here)
  {
    type: "message",
    content: {
      text: "You can get started for free — no card required:\n👉 https://app.replybase.co.uk\n\nIf you'd like to talk through which plan fits your situation, just say the word and I'll get someone from the team on it.",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 600,
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
// FLOW 3 — flow_features-discussion
//
// Branches by interest keyword. All converge at order 20 for CTA.
//
//  0  — intro
//  1  — feature summary
//  2  — input: feature_interest
//  3  — condition → 10–16
// 10  — multi-channel detail  → 20
// 11  — flow builder detail   → 20
// 12  — AI engine detail      → 20
// 13  — CRM detail            → 20
// 14  — analytics detail      → 20
// 15  — integrations detail   → 20
// 16  — general / all         → 20
// 20  — CTA
// 21  — action: tag_user
// 22  — action: end_flow
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Happy to go through the features — there's quite a bit to ReplyBase but I'll keep it practical rather than overwhelming you with everything at once. 😊",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Here's what ReplyBase covers:\n\n📡 Multi-Channel — Webchat, WhatsApp, Facebook, Telegram in one place\n🔧 Flow Builder — No-code conversation designer\n🧠 AI Intent Engine — Understands what customers actually mean\n👥 CRM & Lead Management — Captures and qualifies leads automatically\n📊 Analytics — See what's working, spot where people drop off\n🔗 Integrations — API, Zapier, Webhooks to connect your existing tools",
      typingEnabled: true,
      typingDurationMs: 1700,
      delayMs: 600,
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "Which of those is most relevant to what you're trying to do?",
      variableName: "feature_interest",
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
        // Multi-channel
        { variableName: "feature_interest", operator: "contains", value: "channel", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "whatsapp", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "facebook", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "messenger", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "telegram", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "multi", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "inbox", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "platform", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "webchat", nextNodeOrder: 10 },
        { variableName: "feature_interest", operator: "contains", value: "chat widget", nextNodeOrder: 10 },
        // Flow builder / automation
        { variableName: "feature_interest", operator: "contains", value: "flow", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "automat", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "builder", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "no-code", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "no code", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "bot", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "chatbot", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "conversation", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "workflow", nextNodeOrder: 11 },
        { variableName: "feature_interest", operator: "contains", value: "sequence", nextNodeOrder: 11 },
        // AI
        { variableName: "feature_interest", operator: "contains", value: "ai", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "artificial intel", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "machine learn", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "intent", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "smart", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "natural language", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "nlp", nextNodeOrder: 12 },
        { variableName: "feature_interest", operator: "contains", value: "understand", nextNodeOrder: 12 },
        // CRM / leads
        { variableName: "feature_interest", operator: "contains", value: "crm", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "lead", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "contact", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "customer", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "database", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "record", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "segment", nextNodeOrder: 13 },
        { variableName: "feature_interest", operator: "contains", value: "tag", nextNodeOrder: 13 },
        // Analytics
        { variableName: "feature_interest", operator: "contains", value: "analytic", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "report", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "insight", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "dashboard", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "statistic", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "metric", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "performance", nextNodeOrder: 14 },
        { variableName: "feature_interest", operator: "contains", value: "conversion", nextNodeOrder: 14 },
        // Integrations / API
        { variableName: "feature_interest", operator: "contains", value: "integrat", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "api", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "webhook", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "zapier", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "connect", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "sync", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "hubspot", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "slack", nextNodeOrder: 15 },
        { variableName: "feature_interest", operator: "contains", value: "third party", nextNodeOrder: 15 },
      ],
      nextNodeOrder: 16,
    },
    order: 3,
  },
  // ── Multi-channel
  {
    type: "message",
    content: {
      text: "Multi-channel is one of the things people find most useful about ReplyBase.\n\nYou manage everything from one inbox:\n• Webchat (one line of code on any site)\n• WhatsApp Business\n• Facebook Messenger\n• Telegram\n\nThe same flows and CRM work across all of them. Set it up once and your bot is live on every channel straight away.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 10,
  },
  // ── Flow Builder
  {
    type: "message",
    content: {
      text: "The Flow Builder is the core of ReplyBase — it's a visual, no-code editor for designing conversation paths.\n\nYou can add:\n• Message nodes — text responses with typing effects\n• Input nodes — collect names, emails, numbers, anything\n• Condition nodes — branch based on what the customer says\n• Action nodes — tag leads, update status, call sub-flows\n\nMost people have their first bot working within half an hour.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 11,
  },
  // ── AI
  {
    type: "message",
    content: {
      text: "The AI side of ReplyBase handles intent recognition — so your bot understands what someone means, not just what they literally typed.\n\nIn practice this means:\n• Customers don't have to phrase things perfectly\n• The bot routes them correctly even with typos or variations\n• You get higher completion rates without constantly tweaking your flows\n\nIt works alongside your flow logic, not instead of it.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 12,
  },
  // ── CRM
  {
    type: "message",
    content: {
      text: "The built-in CRM keeps everything in one place — no separate tool needed for basic lead management.\n\nEvery conversation creates a contact record with:\n• Name, email, phone from your flows\n• Full conversation history\n• Custom tags (e.g. 'hot-lead', 'pricing-interest')\n• Status tracking from new → qualified → converted\n• Which channel and flow they came from\n\nYou can also push data to your existing CRM via API if you need to.",
      typingEnabled: true,
      typingDurationMs: 1700,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 13,
  },
  // ── Analytics
  {
    type: "message",
    content: {
      text: "The analytics dashboard shows you what's actually happening in your conversations.\n\nYou can see:\n• Flow completion rates and where people drop off\n• Lead conversion by channel\n• Response times\n• Top-performing paths\n\nPro and Business plans get more detailed dashboards with date filters and export options.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 14,
  },
  // ── Integrations / API
  {
    type: "message",
    content: {
      text: "Integrations are available on Pro and Business plans.\n\nWhat's supported:\n• REST API — full programmatic access\n• Webhooks — real-time event pushes\n• Zapier — connect to 1,000+ apps without writing code\n• CSV/JSON lead exports\n\nCommon setups: pushing leads to HubSpot, firing Slack notifications, syncing with your e-commerce platform.",
      typingEnabled: true,
      typingDurationMs: 1600,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 15,
  },
  // ── General / all features
  {
    type: "message",
    content: {
      text: "You can get a full breakdown of everything at:\n👉 https://replybase.co.uk\n\nIf you'd like a live walkthrough of any specific part, just let me know and I'll arrange a demo with the team.",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 400,
      nextNodeOrder: 20,
    },
    order: 16,
  },
  // ── CTA (all branches land here)
  {
    type: "message",
    content: {
      text: "Want to try it yourself? The free plan is the easiest way to get a feel for things:\n👉 https://app.replybase.co.uk\n\nOr I can set you up with a demo — just say the word. 🎯",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 500,
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
// FLOW 4 — flow_contact
//
//  0  — intro
//  1  — contact details
//  2  — input: contact_callback (yes/no)
//  3  — condition → 10 (yes) | 15 (no)
// 10  — input: callback_email
// 11  — confirmation message
// 12  — action: tag_user
// 13  — action: end_flow
// 15  — message: no worries + link
// 16  — action: end_flow
// ─────────────────────────────────────────────────────────────────────────────

const CONTACT_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Of course — happy to get you the right contact info.",
      typingEnabled: true,
      typingDurationMs: 800,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Here's how to reach us:\n\n📧 Email: admin@replybase.co.uk\n🌐 Contact form: https://replybase.co.uk/contact\n💬 Live chat on the website — available Mon–Fri, 9am–5pm GMT\n\nWe usually reply within a few hours on business days.",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 500,
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "Would you like someone from the team to reach out to you directly? Just say yes or no.",
      variableName: "contact_callback",
      inputType: "text",
      typingEnabled: true,
      typingDurationMs: 900,
      delayMs: 400,
    },
    order: 2,
  },
  {
    type: "condition",
    content: {
      conditions: [
        { variableName: "contact_callback", operator: "contains", value: "yes", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "yeah", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "sure", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "please", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "ok", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "yep", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "go ahead", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "that would", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "love that", nextNodeOrder: 10 },
        { variableName: "contact_callback", operator: "contains", value: "sounds good", nextNodeOrder: 10 },
      ],
      nextNodeOrder: 15,
    },
    order: 3,
  },
  // ── Yes: capture callback email
  {
    type: "input",
    content: {
      text: "Great! What email address should we use?",
      variableName: "callback_email",
      inputType: "email",
      typingEnabled: true,
      typingDurationMs: 800,
      delayMs: 300,
    },
    order: 10,
  },
  {
    type: "message",
    content: {
      text: "Perfect — we'll be in touch at {{callback_email}} within 1 business day. Looking forward to it! 🤝",
      typingEnabled: true,
      typingDurationMs: 1100,
      delayMs: 300,
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
  // ── No: direct to contact page
  {
    type: "message",
    content: {
      text: "No problem at all. Whenever you're ready, our contact page is always there:\n👉 https://replybase.co.uk/contact",
      typingEnabled: true,
      typingDurationMs: 1100,
      delayMs: 300,
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
// FLOW 5 — flow_tutorial
//
// Four clear steps. Friendly but not patronising.
//  0  — intro
//  1–4 — Step 1–4 messages
//  5  — docs link
//  6  — action: tag_user
//  7  — action: end_flow
// ─────────────────────────────────────────────────────────────────────────────

const TUTORIAL_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Sure — getting started is actually pretty quick. Let me walk you through it.",
      typingEnabled: true,
      typingDurationMs: 1000,
      delayMs: 0,
    },
    order: 0,
  },
  {
    type: "message",
    content: {
      text: "Step 1 — Create your account\n\nGo to https://app.replybase.co.uk and sign up. No credit card needed. Takes about 60 seconds and you're in.",
      typingEnabled: true,
      typingDurationMs: 1200,
      delayMs: 700,
    },
    order: 1,
  },
  {
    type: "message",
    content: {
      text: "Step 2 — Connect your channels\n\nFrom the dashboard, go to Settings → Channels. Add whichever you need — Webchat, WhatsApp, Facebook, or Telegram.\n\nThe Webchat embed is just a single script tag on your site — done in under a minute.",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 800,
    },
    order: 2,
  },
  {
    type: "message",
    content: {
      text: "Step 3 — Build your first flow\n\nHead to Flows → Create New. You can start from a template or blank canvas. The visual editor lets you drag and drop message, input, condition, and action nodes.\n\nMost people have something working in 20–30 minutes.",
      typingEnabled: true,
      typingDurationMs: 1400,
      delayMs: 800,
    },
    order: 3,
  },
  {
    type: "message",
    content: {
      text: "Step 4 — Activate and go live\n\nHit Activate on your flow. Your bot starts responding straight away on all the channels you've connected. That's it — you're live. 🎉",
      typingEnabled: true,
      typingDurationMs: 1300,
      delayMs: 800,
    },
    order: 4,
  },
  {
    type: "message",
    content: {
      text: "If you want to go deeper, our docs are here:\n👉 https://replybase.co.uk/docs\n\nAnd if you get stuck on anything, just ask — that's what I'm here for.",
      typingEnabled: true,
      typingDurationMs: 1200,
      delayMs: 600,
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
// FLOW 6 — flow_Initial  (The Orchestrator — "Aria")
//
// DESIGN:
//   1. Greet the visitor warmly as Aria.
//   2. Ask one warm question to gauge interest — captures their response.
//   3. IMMEDIATELY call flow_lead-generation (sub-flow) regardless of answer.
//      → This ensures lead data is always captured early.
//   4. After lead-gen returns, ask what they'd like to explore.
//   5. Route to the appropriate sub-flow based on intent keywords.
//   6. After sub-flow completes, offer a follow-up or close gracefully.
//
// Node layout:
//
//  0   — greeting (Aria introduces herself)
//  1   — interest question + input: visitor_interest
//  2   — bridging message before lead-gen
//  3   — action: call_flow → flow_lead-generation  (nextNodeOrder: 10)
//
//  10  — message: now let's talk about what they need (post lead-gen)
//  11  — input: explore_topic
//  12  — condition → 20 (pricing) | 30 (features) | 40 (contact) | 50 (tutorial) | 60 (default bridge)
//
//  20  — bridge message → action: call_flow → flow_pricing-discussion (→ 70)
//  21  — action: call_flow pricing  (nextNodeOrder: 70)
//
//  30  — bridge message → action: call_flow → flow_features-discussion (→ 70)
//  31  — action: call_flow features  (nextNodeOrder: 70)
//
//  40  — bridge message → action: call_flow → flow_contact (→ 70)
//  41  — action: call_flow contact  (nextNodeOrder: 70)
//
//  50  — bridge message → action: call_flow → flow_tutorial (→ 70)
//  51  — action: call_flow tutorial  (nextNodeOrder: 70)
//
//  60  — default bridge (no clear match) → re-use pricing as gentle nudge
//  61  — action: call_flow pricing  (nextNodeOrder: 70)
//
//  70  — follow-up question: anything else?
//  71  — input: followup_need
//  72  — condition → 73 (pricing) | 74 (features) | 75 (contact) | 76 (tutorial) | 80 (close)
//  73  — action: call_flow pricing  (→ 80)
//  74  — action: call_flow features  (→ 80)
//  75  — action: call_flow contact   (→ 80)
//  76  — action: call_flow tutorial  (→ 80)
//
//  80  — goodbye message
//  81  — goodbye message 2
//  82  — action: tag_user initial-flow-completed
//  83  — action: end_flow
// ─────────────────────────────────────────────────────────────────────────────

function buildInitialNodes(ids: Record<string, string>): NodeInput[] {
  const pricing = ids["flow_pricing-discussion"] ?? "";
  const features = ids["flow_features-discussion"] ?? "";
  const contact = ids["flow_contact"] ?? "";
  const tutorial = ids["flow_tutorial"] ?? "";
  const leadgen = ids["flow_lead-generation"] ?? "";

  return [
    // ── Greeting
    {
      type: "message",
      content: {
        text: "Hi there! 👋 I'm Aria from ReplyBase. Good to have you here.",
        typingEnabled: true,
        typingDurationMs: 1100,
        delayMs: 0,
      },
      order: 0,
    },
    // ── Warm interest question
    {
      type: "input",
      content: {
        text: "What caught your attention about ReplyBase — or is there something specific you're looking to sort out?",
        variableName: "visitor_interest",
        inputType: "text",
        typingEnabled: true,
        typingDurationMs: 1000,
        delayMs: 600,
      },
      order: 1,
    },
    // ── Bridge into lead-gen
    {
      type: "message",
      content: {
        text: "That's helpful, thanks. Before I get into the details — let me just grab a couple of quick things so I can make sure whatever I share is actually relevant to your situation.",
        typingEnabled: true,
        typingDurationMs: 1400,
        delayMs: 400,
      },
      order: 2,
    },
    // ── ALWAYS call lead-gen first
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_lead-generation",
        targetFlowId: leadgen,
        nextNodeOrder: 10,
      },
      order: 3,
    },

    // ── Post lead-gen: offer to explore
    {
      type: "message",
      content: {
        text: "Right — so what would be most useful to go through next?",
        typingEnabled: true,
        typingDurationMs: 900,
        delayMs: 500,
      },
      order: 10,
    },
    {
      type: "input",
      content: {
        text: "I can cover pricing, features, how to get started, or answer any specific questions. What's on your mind?",
        variableName: "explore_topic",
        inputType: "text",
        typingEnabled: true,
        typingDurationMs: 1100,
        delayMs: 300,
      },
      order: 11,
    },
    // ── Intent routing
    {
      type: "condition",
      content: {
        conditions: [
          // Pricing intent — broad net
          { variableName: "explore_topic", operator: "contains", value: "price", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "pricing", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "cost", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "costs", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "plan", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "plans", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "how much", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "how expensive", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "afford", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "paid", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "cheap", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "expensive", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "subscript", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "tier", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "budget", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "£", nextNodeOrder: 20 },
          { variableName: "explore_topic", operator: "contains", value: "$", nextNodeOrder: 20 },
          // Features intent — broad net
          { variableName: "explore_topic", operator: "contains", value: "feature", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "features", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "what does", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "what can", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "how does", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "how do", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "does it", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "can it", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "demo", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "show me", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "capabilit", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "function", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "automat", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "chatbot", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "bot", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "channel", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "whatsapp", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "facebook", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "telegram", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "ai", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "crm", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "analytic", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "integrat", nextNodeOrder: 30 },
          { variableName: "explore_topic", operator: "contains", value: "api", nextNodeOrder: 30 },
          // Contact / human intent
          { variableName: "explore_topic", operator: "contains", value: "contact", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "speak to", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "talk to", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "talk with", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "chat with", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "human", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "person", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "someone", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "real person", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "call me", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "email me", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "reach out", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "get in touch", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "support", nextNodeOrder: 40 },
          { variableName: "explore_topic", operator: "contains", value: "help", nextNodeOrder: 40 },
          // Tutorial / getting started intent
          { variableName: "explore_topic", operator: "contains", value: "get started", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "getting started", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "how to start", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "how do i start", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "set up", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "setup", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "onboard", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "tutorial", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "guide", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "walkthrough", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "step by step", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "begin", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "first time", nextNodeOrder: 50 },
          { variableName: "explore_topic", operator: "contains", value: "new to", nextNodeOrder: 50 },
        ],
        nextNodeOrder: 60, // Default: gentle pricing nudge
      },
      order: 12,
    },

    // ── Branch: Pricing (20 → 21)
    {
      type: "message",
      content: {
        text: "Sure — let me go through the plans with you.",
        typingEnabled: true,
        typingDurationMs: 700,
        delayMs: 200,
      },
      order: 20,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_pricing-discussion",
        targetFlowId: pricing,
        nextNodeOrder: 70,
      },
      order: 21,
    },

    // ── Branch: Features (30 → 31)
    {
      type: "message",
      content: {
        text: "Good question — let me walk you through what's available.",
        typingEnabled: true,
        typingDurationMs: 800,
        delayMs: 200,
      },
      order: 30,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_features-discussion",
        targetFlowId: features,
        nextNodeOrder: 70,
      },
      order: 31,
    },

    // ── Branch: Contact (40 → 41)
    {
      type: "message",
      content: {
        text: "Of course — let me get you the contact details.",
        typingEnabled: true,
        typingDurationMs: 700,
        delayMs: 200,
      },
      order: 40,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_contact",
        targetFlowId: contact,
        nextNodeOrder: 70,
      },
      order: 41,
    },

    // ── Branch: Tutorial (50 → 51)
    {
      type: "message",
      content: {
        text: "Happy to walk you through it — it's straightforward, I promise.",
        typingEnabled: true,
        typingDurationMs: 900,
        delayMs: 200,
      },
      order: 50,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_tutorial",
        targetFlowId: tutorial,
        nextNodeOrder: 70,
      },
      order: 51,
    },

    // ── Default: gentle nudge to pricing
    {
      type: "message",
      content: {
        text: "I'll start with a quick overview of what ReplyBase offers and how the pricing works — that usually gives people a clear picture.",
        typingEnabled: true,
        typingDurationMs: 1200,
        delayMs: 300,
      },
      order: 60,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_pricing-discussion",
        targetFlowId: pricing,
        nextNodeOrder: 70,
      },
      order: 61,
    },

    // ── Follow-up (70 → 71 → 72)
    {
      type: "message",
      content: {
        text: "Is there anything else you'd like to go through?",
        typingEnabled: true,
        typingDurationMs: 800,
        delayMs: 500,
      },
      order: 70,
    },
    {
      type: "input",
      content: {
        text: "Ask away, or just say 'no' if we're done here.",
        variableName: "followup_need",
        inputType: "text",
        typingEnabled: true,
        typingDurationMs: 600,
        delayMs: 200,
      },
      order: 71,
    },
    {
      type: "condition",
      content: {
        conditions: [
          // Pricing follow-up
          { variableName: "followup_need", operator: "contains", value: "price", nextNodeOrder: 73 },
          { variableName: "followup_need", operator: "contains", value: "pricing", nextNodeOrder: 73 },
          { variableName: "followup_need", operator: "contains", value: "cost", nextNodeOrder: 73 },
          { variableName: "followup_need", operator: "contains", value: "plan", nextNodeOrder: 73 },
          { variableName: "followup_need", operator: "contains", value: "how much", nextNodeOrder: 73 },
          { variableName: "followup_need", operator: "contains", value: "subscript", nextNodeOrder: 73 },
          // Features follow-up
          { variableName: "followup_need", operator: "contains", value: "feature", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "what does", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "how does", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "does it", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "can it", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "demo", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "automat", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "channel", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "ai", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "crm", nextNodeOrder: 74 },
          { variableName: "followup_need", operator: "contains", value: "integrat", nextNodeOrder: 74 },
          // Contact follow-up
          { variableName: "followup_need", operator: "contains", value: "contact", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "speak to", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "talk to", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "human", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "someone", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "support", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "help", nextNodeOrder: 75 },
          { variableName: "followup_need", operator: "contains", value: "email", nextNodeOrder: 75 },
          // Tutorial follow-up
          { variableName: "followup_need", operator: "contains", value: "get started", nextNodeOrder: 76 },
          { variableName: "followup_need", operator: "contains", value: "tutorial", nextNodeOrder: 76 },
          { variableName: "followup_need", operator: "contains", value: "guide", nextNodeOrder: 76 },
          { variableName: "followup_need", operator: "contains", value: "setup", nextNodeOrder: 76 },
          { variableName: "followup_need", operator: "contains", value: "set up", nextNodeOrder: 76 },
          // Graceful close
          { variableName: "followup_need", operator: "contains", value: "no", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "nope", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "done", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "thanks", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "thank you", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "bye", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "goodbye", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "nothing", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "all good", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "that's all", nextNodeOrder: 80 },
          { variableName: "followup_need", operator: "contains", value: "that's it", nextNodeOrder: 80 },
        ],
        nextNodeOrder: 80,
      },
      order: 72,
    },
    // ── Follow-up routing sub-flow calls
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_pricing-discussion",
        targetFlowId: pricing,
        nextNodeOrder: 80,
      },
      order: 73,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_features-discussion",
        targetFlowId: features,
        nextNodeOrder: 80,
      },
      order: 74,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_contact",
        targetFlowId: contact,
        nextNodeOrder: 80,
      },
      order: 75,
    },
    {
      type: "action",
      content: {
        action: "call_flow",
        targetFlowName: "flow_tutorial",
        targetFlowId: tutorial,
        nextNodeOrder: 80,
      },
      order: 76,
    },

    // ── Goodbye
    {
      type: "message",
      content: {
        text: "Thanks for stopping by — it was good chatting with you. 😊\n\nWe'll be in touch soon. And if anything else comes up, just start a chat and I'll be here.",
        typingEnabled: true,
        typingDurationMs: 1400,
        delayMs: 400,
      },
      order: 80,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: ["initial-flow-completed"],
      },
      order: 81,
    },
    {
      type: "action",
      content: {
        action: "end_flow",
      },
      order: 82,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  try {
    console.log("🎭  ReplyBase Orchestra Flows — seed starting...\n");

    // 1. Find the target user
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
    console.log(`✅  User:       ${user.email}`);
    console.log(`    Tenant ID:  ${tenantId}`);
    console.log(`    User ID:    ${ownerId}`);

    // 2. Wipe all existing flows for this tenant
    await deleteAllTenantFlows(tenantId);

    // 3. Create sub-flows first (needed for their IDs)
    console.log("\n📋  Creating sub-flows...");

    const leadGenFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_lead-generation",
      description:
        "Primary lead capture — name, email, phone, business type, volume, budget. Tags + qualifies the lead in CRM.",
      fallbackMessage: "I didn't quite catch that. Could you give it another go?",
      nodes: LEAD_GEN_NODES,
    });
    console.log(`    ✅  flow_lead-generation       (${leadGenFlow.id})`);

    const pricingFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_pricing-discussion",
      description:
        "Pricing overview: Free, Starter, Pro, Business — plan detail branches + sign-up CTA.",
      fallbackMessage: "Got a question about pricing? Just ask.",
      nodes: PRICING_NODES,
    });
    console.log(`    ✅  flow_pricing-discussion    (${pricingFlow.id})`);

    const featuresFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_features-discussion",
      description:
        "Feature deep-dive: multi-channel, flow builder, AI, CRM, analytics, integrations.",
      fallbackMessage: "Happy to answer any questions about features.",
      nodes: FEATURES_NODES,
    });
    console.log(`    ✅  flow_features-discussion   (${featuresFlow.id})`);

    const contactFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_contact",
      description: "Contact details + optional callback email capture.",
      fallbackMessage: "You can always reach us at admin@replybase.co.uk.",
      nodes: CONTACT_NODES,
    });
    console.log(`    ✅  flow_contact               (${contactFlow.id})`);

    const tutorialFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_tutorial",
      description:
        "4-step getting-started guide: create account → connect channels → build flow → go live.",
      fallbackMessage: "More details at replybase.co.uk/docs.",
      nodes: TUTORIAL_NODES,
    });
    console.log(`    ✅  flow_tutorial              (${tutorialFlow.id})\n`);

    // 4. Build flow_Initial with real sub-flow IDs resolved
    console.log("🎭  Creating flow_Initial (orchestrator)...");

    const initialFlow = await upsertFlow(tenantId, ownerId, {
      name: "flow_Initial",
      description:
        "Orchestrator for all channels. Greets visitor, captures lead immediately (flow_lead-generation), then routes to the right sub-flow based on intent. Bot: Aria.",
      fallbackMessage: "Hi! I'm Aria from ReplyBase — ask me anything. 😊",
      nodes: buildInitialNodes({
        "flow_lead-generation": leadGenFlow.id,
        "flow_pricing-discussion": pricingFlow.id,
        "flow_features-discussion": featuresFlow.id,
        "flow_contact": contactFlow.id,
        "flow_tutorial": tutorialFlow.id,
      }),
    });
    console.log(`    ✅  flow_Initial               (${initialFlow.id})\n`);

    // 5. Summary
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );
    console.log("🎉  Done! All Orchestra flows are live.\n");
    console.log("    Flow IDs:");
    console.log(`      flow_Initial              → ${initialFlow.id}`);
    console.log(`      flow_lead-generation      → ${leadGenFlow.id}`);
    console.log(`      flow_pricing-discussion   → ${pricingFlow.id}`);
    console.log(`      flow_features-discussion  → ${featuresFlow.id}`);
    console.log(`      flow_contact              → ${contactFlow.id}`);
    console.log(`      flow_tutorial             → ${tutorialFlow.id}`);
    console.log(
      "\n    All flows: isActive = true. Assign flow_Initial to your channels in the dashboard.",
    );
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    );
  } catch (error) {
    console.error("❌  Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
