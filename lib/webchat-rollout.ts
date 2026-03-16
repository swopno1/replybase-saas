import { prisma } from "@/lib/prisma";

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
  const mode = (process.env.WEBCHAT_ROLLOUT_MODE || "off").toLowerCase();
  if (mode === "pilot" || mode === "tiered" || mode === "ga") {
    return mode;
  }
  return "off";
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

export async function getWebchatRolloutDecision(
  tenantId: string,
): Promise<WebchatRolloutDecision> {
  const mode = parseRolloutMode();
  const forceEnabledTenants = parseCsvEnv(
    process.env.WEBCHAT_ENABLED_TENANT_IDS,
  );
  const forceDisabledTenants = parseCsvEnv(
    process.env.WEBCHAT_DISABLED_TENANT_IDS,
  );
  const pilotTenants = parseCsvEnv(process.env.WEBCHAT_PILOT_TENANT_IDS);
  const allowedPlans = new Set(
    Array.from(parseCsvEnv(process.env.WEBCHAT_ALLOWED_PLAN_NAMES)).map(
      (name) => normalizePlanName(name),
    ),
  );

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
