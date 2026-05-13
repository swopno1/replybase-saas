import { prisma } from "@/lib/prisma";
import { APP_CONFIG } from "./config";

export type WebchatRolloutMode = "off" | "pilot" | "tiered" | "ga";

export type WebchatRolloutDecision = {
  allowed: boolean;
  mode: WebchatRolloutMode;
  reason:
    | "rollout_not_enforced"
    | "tenant_force_enabled"
    | "tenant_force_disabled"
    | "pilot_tenant_allowed"
    | "pilot_only"
    | "plan_feature_enabled"
    | "plan_feature_disabled"
    | "plan_allowlisted"
    | "plan_not_allowlisted"
    | "ga_enabled";
  planName?: string;
};

type PlanFeatures = Record<string, unknown>;

export type WebchatRolloutConfig = {
  mode: WebchatRolloutMode;
  enabledTenantIds: string[];
  disabledTenantIds: string[];
  pilotTenantIds: string[];
  allowedPlanNames: string[];
};

// --- ENV KEYS ---
const ROLLOUT_MODE_ENV = "WEBCHAT_ROLLOUT_MODE";
const ENABLED_TENANTS_ENV = "WEBCHAT_ENABLED_TENANT_IDS";
const DISABLED_TENANTS_ENV = "WEBCHAT_DISABLED_TENANT_IDS";
const PILOT_TENANTS_ENV = "WEBCHAT_PILOT_TENANT_IDS";
const ALLOWED_PLANS_ENV = "WEBCHAT_ALLOWED_PLAN_NAMES";

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function normalizePlanName(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase();
}

function getBooleanFeature(
  features: unknown,
  key: string,
): boolean | undefined {
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return undefined;
  }

  const value = (features as PlanFeatures)[key];
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Gets rollout configuration. Prioritizes runtime process.env overrides
 * (set by Admin UI) over static APP_CONFIG defaults.
 */
export function getWebchatRolloutConfig(): WebchatRolloutConfig {
  const defaults = APP_CONFIG.webchat.rollout;
  
  return {
    mode: (process.env[ROLLOUT_MODE_ENV] as WebchatRolloutMode) || defaults.mode,
    enabledTenantIds: process.env[ENABLED_TENANTS_ENV] 
      ? parseCsv(process.env[ENABLED_TENANTS_ENV]) 
      : defaults.enabledTenants,
    disabledTenantIds: process.env[DISABLED_TENANTS_ENV] 
      ? parseCsv(process.env[DISABLED_TENANTS_ENV]) 
      : defaults.disabledTenants,
    pilotTenantIds: process.env[PILOT_TENANTS_ENV] 
      ? parseCsv(process.env[PILOT_TENANTS_ENV]) 
      : defaults.pilotTenants,
    allowedPlanNames: process.env[ALLOWED_PLANS_ENV] 
      ? parseCsv(process.env[ALLOWED_PLANS_ENV]).map(normalizePlanName) 
      : defaults.allowedPlans,
  };
}

/**
 * Updates the rollout configuration at runtime by setting environment variables.
 * Note: These changes do not persist across server restarts.
 */
export function updateWebchatRolloutConfig(
  input: WebchatRolloutConfig,
): WebchatRolloutConfig {
  process.env[ROLLOUT_MODE_ENV] = input.mode;
  process.env[ENABLED_TENANTS_ENV] = input.enabledTenantIds.join(",");
  process.env[DISABLED_TENANTS_ENV] = input.disabledTenantIds.join(",");
  process.env[PILOT_TENANTS_ENV] = input.pilotTenantIds.join(",");
  process.env[ALLOWED_PLANS_ENV] = input.allowedPlanNames.join(",");

  return getWebchatRolloutConfig();
}

export async function getWebchatRolloutDecision(
  tenantId: string,
): Promise<WebchatRolloutDecision> {
  const config = getWebchatRolloutConfig();
  const mode = config.mode;
  const forceEnabledTenants = new Set(config.enabledTenantIds);
  const forceDisabledTenants = new Set(config.disabledTenantIds);
  const pilotTenants = new Set(config.pilotTenantIds);
  const allowedPlans = new Set(config.allowedPlanNames);

  if (mode === "off") {
    return {
      allowed: true,
      mode,
      reason: "rollout_not_enforced",
    };
  }

  if (forceDisabledTenants.has(tenantId)) {
    return {
      allowed: false,
      mode,
      reason: "tenant_force_disabled",
    };
  }

  if (forceEnabledTenants.has(tenantId)) {
    return {
      allowed: true,
      mode,
      reason: "tenant_force_enabled",
    };
  }

  if (mode === "ga") {
    return {
      allowed: true,
      mode,
      reason: "ga_enabled",
    };
  }

  if (pilotTenants.has(tenantId)) {
    return {
      allowed: true,
      mode,
      reason: "pilot_tenant_allowed",
    };
  }

  if (mode === "pilot") {
    return {
      allowed: false,
      mode,
      reason: "pilot_only",
    };
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: {
        in: ["active", "trialing"],
      },
    },
    include: {
      plan: {
        select: {
          name: true,
          features: true,
        },
      },
    },
  });

  const planName = normalizePlanName(subscription?.plan?.name);
  const webchatEnabled = getBooleanFeature(
    subscription?.plan?.features,
    "webchat_enabled",
  );

  if (webchatEnabled === false) {
    return {
      allowed: false,
      mode,
      reason: "plan_feature_disabled",
      planName,
    };
  }

  if (webchatEnabled === true) {
    return {
      allowed: true,
      mode,
      reason: "plan_feature_enabled",
      planName,
    };
  }

  if (planName && allowedPlans.has(planName)) {
    return {
      allowed: true,
      mode,
      reason: "plan_allowlisted",
      planName,
    };
  }

  return {
    allowed: false,
    mode,
    reason: "plan_not_allowlisted",
    planName,
  };
}
