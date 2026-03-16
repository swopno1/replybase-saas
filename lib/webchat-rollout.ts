import { prisma } from "@/lib/prisma";

export type WebchatRolloutMode = "off" | "pilot" | "tiered" | "ga";

const ROLLOUT_MODE_ENV = "WEBCHAT_ROLLOUT_MODE";
const ENABLED_TENANTS_ENV = "WEBCHAT_ENABLED_TENANT_IDS";
const DISABLED_TENANTS_ENV = "WEBCHAT_DISABLED_TENANT_IDS";
const PILOT_TENANTS_ENV = "WEBCHAT_PILOT_TENANT_IDS";
const ALLOWED_PLANS_ENV = "WEBCHAT_ALLOWED_PLAN_NAMES";

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

function parseCsvEnv(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function normalizePlanName(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase();
}

function parseRolloutMode(): WebchatRolloutMode {
  const mode = (process.env[ROLLOUT_MODE_ENV] || "off").toLowerCase();
  if (mode === "pilot" || mode === "tiered" || mode === "ga") {
    return mode;
  }
  return "off";
}

function toSortedList(values: Set<string>) {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function applyCsvEnv(key: string, values: string[]) {
  const normalized = values.map((entry) => entry.trim()).filter(Boolean);
  if (normalized.length === 0) {
    delete process.env[key];
    return;
  }

  process.env[key] = normalized.join(",");
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

export function getWebchatRolloutConfig(): WebchatRolloutConfig {
  return {
    mode: parseRolloutMode(),
    enabledTenantIds: toSortedList(
      parseCsvEnv(process.env[ENABLED_TENANTS_ENV]),
    ),
    disabledTenantIds: toSortedList(
      parseCsvEnv(process.env[DISABLED_TENANTS_ENV]),
    ),
    pilotTenantIds: toSortedList(parseCsvEnv(process.env[PILOT_TENANTS_ENV])),
    allowedPlanNames: toSortedList(
      new Set(
        Array.from(parseCsvEnv(process.env[ALLOWED_PLANS_ENV])).map((name) =>
          normalizePlanName(name),
        ),
      ),
    ),
  };
}

export function updateWebchatRolloutConfig(
  input: WebchatRolloutConfig,
): WebchatRolloutConfig {
  process.env[ROLLOUT_MODE_ENV] = input.mode;
  applyCsvEnv(ENABLED_TENANTS_ENV, input.enabledTenantIds);
  applyCsvEnv(DISABLED_TENANTS_ENV, input.disabledTenantIds);
  applyCsvEnv(PILOT_TENANTS_ENV, input.pilotTenantIds);
  applyCsvEnv(
    ALLOWED_PLANS_ENV,
    input.allowedPlanNames.map((name) => normalizePlanName(name)),
  );

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
