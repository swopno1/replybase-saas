/**
 * Official Plan Configurations - August 2026 Migration
 * This is the single source of truth for all plan-related limits and pricing.
 */

export const SLA_TIERS = {
  community: {
    name: "Community",
    responseTarget: null,
    channels: ["Community forum"],
    features: [],
    badge: null,
  },
  standard: {
    name: "Standard Email",
    responseTarget: "48h",
    channels: ["Email"],
    features: ["Best-effort response", "Email support"],
    badge: null,
  },
  priority: {
    name: "Priority Email",
    responseTarget: "24h",
    channels: ["Email"],
    features: ["Priority queue", "Email support", "24h response target"],
    badge: null,
  },
  priorityPlus: {
    name: "Priority+",
    responseTarget: "4h",
    channels: ["Email", "Dedicated Slack/WhatsApp channel option"],
    features: [
      "Priority+ queue",
      "4h response target",
      "Dedicated Slack/WhatsApp channel (optional)",
      "Quarterly review call",
    ],
    badge: "Priority+",
  },
} as const;

export type SlaTierKey = keyof typeof SLA_TIERS;

export const PLAN_CONFIGS = {
  free: {
    name: "free",
    displayName: "Free",
    price: 0,
    dailyMessageLimit: 100,
    monthlyMessageLimit: 100,
    flowExecutionCap: 200,
    maxBots: 1,
    maxChannelsPerBot: 1,
    maxConversations: 100,
    allowedChannels: ["web"],
    apiAccess: false,
    maxApiKeys: 0,
    whiteLabelBranding: false,
    slaTier: "community" as SlaTierKey,
  },
  launch: {
    name: "launch",
    displayName: "Launch",
    price: 2900,
    dailyMessageLimit: 100,
    monthlyMessageLimit: 1000,
    flowExecutionCap: 1500,
    maxBots: 2,
    maxChannelsPerBot: 2,
    maxConversations: 1500,
    allowedChannels: ["web", "facebook", "whatsapp"],
    apiAccess: false,
    maxApiKeys: 0,
    whiteLabelBranding: false,
    slaTier: "standard" as SlaTierKey,
  },
  grow: {
    name: "grow",
    displayName: "Grow",
    price: 4900,
    dailyMessageLimit: 250,
    monthlyMessageLimit: 3500,
    flowExecutionCap: 5000,
    maxBots: 5,
    maxChannelsPerBot: 3,
    maxConversations: 5000,
    allowedChannels: ["web", "facebook", "whatsapp"],
    apiAccess: false,
    maxApiKeys: 0,
    whiteLabelBranding: false,
    slaTier: "standard" as SlaTierKey,
  },
  scale: {
    name: "scale",
    displayName: "Scale",
    price: 8900,
    dailyMessageLimit: 500,
    monthlyMessageLimit: 7500,
    flowExecutionCap: 10000,
    maxBots: 10,
    maxChannelsPerBot: 5,
    maxConversations: 10000,
    allowedChannels: ["web", "facebook", "whatsapp", "telegram"],
    apiAccess: true,
    maxApiKeys: 5,
    whiteLabelBranding: false,
    slaTier: "priority" as SlaTierKey,
  },
  business: {
    name: "business",
    displayName: "Business",
    price: 24900,
    dailyMessageLimit: 1500,
    monthlyMessageLimit: 25000,
    flowExecutionCap: 40000,
    maxBots: 25,
    maxChannelsPerBot: 10,
    maxConversations: 40000,
    allowedChannels: ["web", "facebook", "whatsapp", "telegram"],
    apiAccess: true,
    maxApiKeys: 20,
    whiteLabelBranding: true,
    slaTier: "priorityPlus" as SlaTierKey,
  },
} as const;

export type PlanName = keyof typeof PLAN_CONFIGS;

export function getPlanConfig(name: string) {
  const normalized = name.toLowerCase();
  return PLAN_CONFIGS[normalized as PlanName] || PLAN_CONFIGS.free;
}

export function getPlanSla(name: string) {
  const plan = getPlanConfig(name);
  return SLA_TIERS[plan.slaTier];
}

export function isBusinessPlan(name: string) {
  return name.toLowerCase() === "business";
}

export function isPriorityPlusPlan(name: string) {
  const plan = getPlanConfig(name);
  return plan.slaTier === "priorityPlus";
}
