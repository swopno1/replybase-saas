/**
 * Official Plan Configurations
 * This is the single source of truth for all plan-related limits and pricing.
 */

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
  },
} as const;

export type PlanName = keyof typeof PLAN_CONFIGS;

export function getPlanConfig(name: string) {
  let normalized = name.toLowerCase();
  if (normalized === "starter") normalized = "launch";
  if (normalized === "pro") normalized = "scale";
  return PLAN_CONFIGS[normalized as PlanName] || PLAN_CONFIGS.free;
}

