import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getWebchatRolloutDecision } from "@/lib/webchat-rollout";

describe("getWebchatRolloutDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBCHAT_ROLLOUT_MODE;
    delete process.env.WEBCHAT_ENABLED_TENANT_IDS;
    delete process.env.WEBCHAT_DISABLED_TENANT_IDS;
    delete process.env.WEBCHAT_PILOT_TENANT_IDS;
    delete process.env.WEBCHAT_ALLOWED_PLAN_NAMES;
  });

  it("allows all tenants when rollout mode is off", async () => {
    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("rollout_not_enforced");
    expect(vi.mocked(prisma.subscription.findFirst)).not.toHaveBeenCalled();
  });

  it("allows pilot tenant in pilot mode", async () => {
    process.env.WEBCHAT_ROLLOUT_MODE = "pilot";
    process.env.WEBCHAT_PILOT_TENANT_IDS = "tenant_1,tenant_2";

    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("pilot_tenant_allowed");
  });

  it("blocks non-pilot tenant in pilot mode", async () => {
    process.env.WEBCHAT_ROLLOUT_MODE = "pilot";
    process.env.WEBCHAT_PILOT_TENANT_IDS = "tenant_2";

    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("pilot_only");
  });

  it("allows tiered rollout when plan feature webchat_enabled is true", async () => {
    process.env.WEBCHAT_ROLLOUT_MODE = "tiered";
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      plan: {
        name: "launch",
        features: { webchat_enabled: true },
      },
    } as never);

    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("plan_feature_enabled");
    expect(result.planName).toBe("launch");
  });

  it("allows tiered rollout when plan name is allowlisted", async () => {
    process.env.WEBCHAT_ROLLOUT_MODE = "tiered";
    process.env.WEBCHAT_ALLOWED_PLAN_NAMES = "scale,enterprise";
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      plan: {
        name: "Scale",
        features: {},
      },
    } as never);

    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("plan_allowlisted");
    expect(result.planName).toBe("scale");
  });

  it("blocks tiered rollout when plan is not allowlisted and no feature flag", async () => {
    process.env.WEBCHAT_ROLLOUT_MODE = "tiered";
    process.env.WEBCHAT_ALLOWED_PLAN_NAMES = "enterprise";
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      plan: {
        name: "launch",
        features: {},
      },
    } as never);

    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("plan_not_allowlisted");
  });

  it("blocks GA rollout for explicitly disabled tenant", async () => {
    process.env.WEBCHAT_ROLLOUT_MODE = "ga";
    process.env.WEBCHAT_DISABLED_TENANT_IDS = "tenant_1";

    const result = await getWebchatRolloutDecision("tenant_1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("tenant_force_disabled");
  });
});
