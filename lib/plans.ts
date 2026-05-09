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
  },
  starter: {
    name: "starter",
    displayName: "Starter",
    price: 2900,
    dailyMessageLimit: 500,
    monthlyMessageLimit: 1000,
    flowExecutionCap: 1500,
    maxBots: 3,
    maxChannelsPerBot: 5,
  },
  pro: {
    name: "pro",
    displayName: "Pro",
    price: 8900,
    dailyMessageLimit: 2000,
    monthlyMessageLimit: 7500,
    flowExecutionCap: 10000,
    maxBots: 10,
    maxChannelsPerBot: 5,
  },
  business: {
    name: "business",
    displayName: "Business",
    price: 24900,
    dailyMessageLimit: 5000,
    monthlyMessageLimit: 25000,
    flowExecutionCap: 40000,
    maxBots: 25,
    maxChannelsPerBot: 5,
  },
} as const;

export type PlanName = keyof typeof PLAN_CONFIGS;

export function getPlanConfig(name: string) {
  const normalized = name.toLowerCase() as PlanName;
  return PLAN_CONFIGS[normalized] || PLAN_CONFIGS.free;
}
