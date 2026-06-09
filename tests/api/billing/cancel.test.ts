import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks (must be created before vi.mock factories run) ───────────────
const { mockStripeUpdate, mockFindUnique, mockSubUpdate, mockChurnCreate } =
  vi.hoisted(() => ({
    mockStripeUpdate: vi.fn(),
    mockFindUnique: vi.fn(),
    mockSubUpdate: vi.fn(),
    mockChurnCreate: vi.fn(),
  }));

vi.mock("@/lib/stripe", () => ({
  stripe: { subscriptions: { update: mockStripeUpdate } },
}));

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (handler: any) =>
    async (req: NextRequest, ctx: unknown) => {
      const user = { id: "user_1", tenantId: "tenant_1" };
      const db = {
        churnFeedback: { create: mockChurnCreate },
        subscription: { findUnique: mockFindUnique, update: mockSubUpdate },
      };
      return handler(user, req, ctx, db);
    },
}));

import { POST } from "@/app/api/billing/cancel/route";

// ── helpers ────────────────────────────────────────────────────────────────────
const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/billing/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const freeSubscription = {
  id: "sub_free",
  tenantId: "tenant_1",
  stripeId: "free_tenant_1",
  status: "FREE",
  cancelAtPeriodEnd: false,
  plan: { name: "free", displayName: "Free" },
};

const stripeSubscription = {
  id: "sub_paid",
  tenantId: "tenant_1",
  stripeId: "sub_stripe_abc",
  status: "ACTIVE",
  cancelAtPeriodEnd: false,
  plan: { name: "grow", displayName: "Grow" },
};

// ── tests ──────────────────────────────────────────────────────────────────────
describe("POST /api/billing/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChurnCreate.mockResolvedValue({});
  });

  // ── Cancel – FREE plan ───────────────────────────────────────────────────────
  it("cancels a FREE subscription immediately without calling Stripe", async () => {
    mockFindUnique.mockResolvedValue(freeSubscription);
    mockSubUpdate.mockResolvedValue({
      ...freeSubscription,
      status: "CANCELED",
      cancelAtPeriodEnd: true,
    });

    const response = await POST(makeRequest({ feedback: "", type: "CANCEL" }), {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.subscription.status).toBe("CANCELED");
    expect(data.subscription.cancelAtPeriodEnd).toBe(true);
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    expect(mockSubUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CANCELED", cancelAtPeriodEnd: true },
      }),
    );
  });

  // ── Cancel – Stripe plan ─────────────────────────────────────────────────────
  it("sets cancel_at_period_end on Stripe and syncs DB for a paid subscription", async () => {
    mockFindUnique.mockResolvedValue(stripeSubscription);
    mockStripeUpdate.mockResolvedValue({
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1893456000,
    });
    mockSubUpdate.mockResolvedValue({
      ...stripeSubscription,
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
    });

    const response = await POST(makeRequest({ feedback: "", type: "CANCEL" }), {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Subscription set to cancel at period end");
    expect(data.subscription.cancelAtPeriodEnd).toBe(true);
    expect(mockStripeUpdate).toHaveBeenCalledWith("sub_stripe_abc", {
      cancel_at_period_end: true,
    });
  });

  // ── Cancel – churn feedback saved ────────────────────────────────────────────
  it("saves churn feedback before cancelling when feedback is provided", async () => {
    mockFindUnique.mockResolvedValue(freeSubscription);
    mockSubUpdate.mockResolvedValue(freeSubscription);

    await POST(makeRequest({ feedback: "Too expensive", type: "CANCEL" }), {
      params: Promise.resolve({}),
    });

    expect(mockChurnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: "Too expensive",
          type: "CANCEL",
          tenantId: "tenant_1",
          userId: "user_1",
        }),
      }),
    );
  });

  // ── Downgrade – with feedback ────────────────────────────────────────────────
  it("records feedback and returns early for DOWNGRADE type (no cancellation)", async () => {
    const response = await POST(
      makeRequest({ feedback: "Missing feature X", type: "DOWNGRADE" }),
      { params: Promise.resolve({}) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Feedback recorded");
    expect(mockChurnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "DOWNGRADE" }),
      }),
    );
    // Subscription must NOT be touched
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockStripeUpdate).not.toHaveBeenCalled();
  });

  // ── Downgrade – without feedback (bug regression) ────────────────────────────
  it("does NOT cancel the subscription when DOWNGRADE is sent with no feedback", async () => {
    const response = await POST(
      makeRequest({ feedback: "", type: "DOWNGRADE" }),
      { params: Promise.resolve({}) },
    );
    const data = await response.json();

    // Must not touch the subscription at all
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    // Should not expose a subscription in the response
    expect(data).not.toHaveProperty("subscription");
  });

  // ── Subscription not found ───────────────────────────────────────────────────
  it("returns 404 when subscription does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ feedback: "", type: "CANCEL" }), {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Subscription not found");
  });

  // ── Stripe error ─────────────────────────────────────────────────────────────
  it("returns 500 when Stripe throws", async () => {
    mockFindUnique.mockResolvedValue(stripeSubscription);
    mockStripeUpdate.mockRejectedValue(new Error("Stripe network error"));

    const response = await POST(makeRequest({ feedback: "", type: "CANCEL" }), {
      params: Promise.resolve({}),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal Server Error");
  });
});
