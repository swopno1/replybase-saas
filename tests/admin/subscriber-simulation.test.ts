import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/admin/subscribers/[id]/simulate/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { aiFallback } from "@/lib/ai-fallback";
import { logAdminActivity } from "@/lib/admin-audit";
import { NextRequest } from "next/server";

vi.mock("next-auth");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/bot-entry-flow-engine", () => ({
  executeBotEntryFlowFirst: vi.fn(),
}));

vi.mock("@/lib/ai-fallback", () => ({
  aiFallback: vi.fn(),
}));

vi.mock("@/lib/admin-audit", () => ({
  logAdminActivity: vi.fn(),
}));

describe("Subscriber Simulation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: "contact_123" } as any);
  });

  it("should return 401 if user is unauthorized", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/admin/subscribers/sub_123/simulate", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: "sub_123" }) });
    expect(response.status).toBe(401);
  });

  it("should return 404 if subscriber or active bot is not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin_1", role: "ADMIN" },
    } as any);

    // Mock subscription not found
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    // Mock tenant not found
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/admin/subscribers/sub_123/simulate", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: "sub_123" }) });
    expect(response.status).toBe(404);
  });

  it("should resolve tenant from subscription ID and execute simulation", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin_1", role: "ADMIN" },
    } as any);

    // Mock subscription mapping to tenant_123
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: "sub_123",
      tenantId: "tenant_123",
    } as any);

    // Mock tenant fetching
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant_123",
      name: "Mock Workspace",
      bots: [{ id: "bot_123", enabled: true }],
      subscriptions: {
        plan: { name: "Growth" },
      },
    } as any);

    // Mock flow execution response
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({
      handled: true,
      responses: [{ type: "text", text: "Welcome to our store!" }],
      flowId: "flow_123",
      flowName: "Welcome Flow",
      flowSessionId: "session_123",
      completed: true,
      waitingForInput: false,
      shouldFallbackToAi: false,
      variables: {},
    } as any);

    const req = new NextRequest("http://localhost/api/admin/subscribers/sub_123/simulate", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: "sub_123" }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.responses[0].text).toBe("Welcome to our store!");

    // Verify correct queries were made
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { id: "sub_123" },
      select: { tenantId: true },
    });
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: "tenant_123" },
      include: {
        bots: { where: { enabled: true }, take: 1 },
        subscriptions: { include: { plan: true } },
      },
    });

    // Verify activity logging
    expect(logAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "SIMULATION_RUN",
        entityType: "subscriber",
        entityId: "tenant_123",
      })
    );
  });

  it("should resolve tenant from no-sub- prefixed ID and execute simulation", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin_1", role: "ADMIN" },
    } as any);

    // Mock tenant fetching directly using 'tenant_123'
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: "tenant_123",
      name: "Mock Workspace",
      bots: [{ id: "bot_123", enabled: true }],
      subscriptions: null,
    } as any);

    // Mock flow execution returning null (triggering AI fallback)
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue(null);

    // Mock AI fallback response
    vi.mocked(aiFallback).mockResolvedValue("AI fallback response text");

    const req = new NextRequest("http://localhost/api/admin/subscribers/no-sub-tenant_123/simulate", {
      method: "POST",
      body: JSON.stringify({ message: "hello", history: [] }),
    });

    const response = await POST(req, { params: Promise.resolve({ id: "no-sub-tenant_123" }) });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.responses[0].text).toBe("AI fallback response text");

    // Subscription query should NOT be called for no-sub-
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: "tenant_123" },
      include: {
        bots: { where: { enabled: true }, take: 1 },
        subscriptions: { include: { plan: true } },
      },
    });

    expect(aiFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: "bot_123",
        planName: "Free", // defaults to "Free" when subscriptions/plan is null
      })
    );
  });
});
