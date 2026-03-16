import { describe, expect, it } from "vitest";
import { evaluateWebchatPromotion } from "@/lib/admin-webchat-monitoring";

const baseReasonCounts = {
  blockedOrigin: 0,
  rateLimit: 0,
  invalidToken: 0,
  invalidInitChallenge: 0,
  botMitigation: 0,
  messageError: 0,
  rolloutDisabled: 0,
  unknown: 0,
};

describe("evaluateWebchatPromotion", () => {
  it("recommends pilot when mode is off and pilot candidates exist", () => {
    const result = evaluateWebchatPromotion({
      mode: "off",
      errorRate24h: 0,
      reasonCounts: baseReasonCounts,
      trackedTenants: [
        {
          rolloutRole: "pilot",
          sessions24h: 0,
          widgetEvents24h: 0,
        },
      ],
    });

    expect(result.status).toBe("ready");
    expect(result.recommendedStage).toBe("pilot");
  });

  it("holds pilot promotion when blockers exist", () => {
    const result = evaluateWebchatPromotion({
      mode: "pilot",
      errorRate24h: 0.09,
      reasonCounts: {
        ...baseReasonCounts,
        blockedOrigin: 12,
        rateLimit: 22,
      },
      trackedTenants: [
        {
          rolloutRole: "pilot",
          sessions24h: 10,
          widgetEvents24h: 100,
        },
      ],
    });

    expect(result.status).toBe("hold");
    expect(result.recommendedStage).toBeNull();
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("recommends tiered from pilot when thresholds are healthy", () => {
    const result = evaluateWebchatPromotion({
      mode: "pilot",
      errorRate24h: 0.01,
      reasonCounts: baseReasonCounts,
      trackedTenants: [
        {
          rolloutRole: "pilot",
          sessions24h: 13,
          widgetEvents24h: 120,
        },
      ],
    });

    expect(result.status).toBe("ready");
    expect(result.recommendedStage).toBe("tiered");
    expect(result.blockers).toEqual([]);
  });

  it("recommends GA from tiered when rollout-denied incidents are zero", () => {
    const result = evaluateWebchatPromotion({
      mode: "tiered",
      errorRate24h: 0.01,
      reasonCounts: baseReasonCounts,
      trackedTenants: [
        {
          rolloutRole: "force-enabled",
          sessions24h: 20,
          widgetEvents24h: 200,
        },
      ],
    });

    expect(result.status).toBe("ready");
    expect(result.recommendedStage).toBe("ga");
  });

  it("holds tiered promotion when rollout-disabled incidents are present", () => {
    const result = evaluateWebchatPromotion({
      mode: "tiered",
      errorRate24h: 0.01,
      reasonCounts: {
        ...baseReasonCounts,
        rolloutDisabled: 2,
      },
      trackedTenants: [
        {
          rolloutRole: "pilot",
          sessions24h: 5,
          widgetEvents24h: 60,
        },
      ],
    });

    expect(result.status).toBe("hold");
    expect(result.recommendedStage).toBeNull();
    expect(result.blockers).toContain(
      "Rollout-disabled incidents are still occurring during tiered rollout.",
    );
  });

  it("returns stable for healthy GA telemetry", () => {
    const result = evaluateWebchatPromotion({
      mode: "ga",
      errorRate24h: 0.01,
      reasonCounts: baseReasonCounts,
      trackedTenants: [],
    });

    expect(result.status).toBe("stable");
    expect(result.recommendedStage).toBeNull();
  });
});
