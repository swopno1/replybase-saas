import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flowChannelAssignment: {
      findFirst: vi.fn(),
    },
    flow: {
      findFirst: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    flowSession: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/subscription", () => ({
  checkTenantUsageLimits: vi.fn().mockResolvedValue({ allowed: true }),
  incrementTenantUsage: vi.fn(),
}));

describe("Bot Entry Flow Engine - Simulation Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null (AI Fallback) when the bot has no flow configured (entryFlow is null/undefined)", async () => {
    // Mock channel assignment to return null
    vi.mocked(prisma.flowChannelAssignment.findFirst).mockResolvedValue(null);
    // Even if flow.findFirst is mocked, it shouldn't be called because resolveFlow returns early
    vi.mocked(prisma.flow.findFirst).mockResolvedValue(null);

    const result = await executeBotEntryFlowFirst({
      isSimulation: true,
      tenantId: "tenant_123",
      botId: "bot_123",
      contactId: "contact_123",
      scopeKey: "sim-scope",
      message: "hello",
      entryFlow: null, // No flow configured
    });

    expect(result).toBeNull();
    expect(prisma.flow.findFirst).not.toHaveBeenCalled();
  });

  it("should return null (AI Fallback) on subsequent turns when the flow has completed (last_node_id is null)", async () => {
    vi.mocked(prisma.flowChannelAssignment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.flow.findFirst).mockResolvedValue({
      id: "flow_123",
      name: "Test Flow",
      nodes: [{ id: "node_1", type: "message", order: 1, content: { text: "Hello" } }],
    } as any);

    // Call with variables showing flow completed (last_node_id === null)
    const result = await executeBotEntryFlowFirst({
      isSimulation: true,
      tenantId: "tenant_123",
      botId: "bot_123",
      contactId: "contact_123",
      scopeKey: "sim-scope",
      message: "hello again",
      entryFlow: "flow_123",
      variables: {
        last_node_id: null, // Flow completed in previous turn
        some_other_var: "value",
      },
    });

    expect(result).toBeNull();
    // It should exit early before looking up the flow in the database
    expect(prisma.flow.findFirst).not.toHaveBeenCalled();
  });

  it("should resolve and execute the flow on the first turn when configured with a flow", async () => {
    vi.mocked(prisma.flowChannelAssignment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.flow.findFirst).mockResolvedValue({
      id: "flow_123",
      name: "Test Flow",
      nodes: [
        { id: "node_1", type: "message", order: 1, content: { text: "Hello", nextNodeOrder: 2 } },
        { id: "node_2", type: "end", order: 2, content: {} },
      ],
    } as any);

    vi.mocked(prisma.contact.findUnique).mockResolvedValue({
      id: "contact_123",
      name: "John Doe",
      leads: [],
    } as any);
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({
      id: "contact_123",
      name: "John Doe",
      email: "john@example.com",
    } as any);

    // First turn: variables is empty/undefined
    const result = await executeBotEntryFlowFirst({
      isSimulation: true,
      tenantId: "tenant_123",
      botId: "bot_123",
      contactId: "contact_123",
      scopeKey: "sim-scope",
      message: "hello",
      entryFlow: "flow_123",
    });

    expect(result).not.toBeNull();
    expect(result?.flowId).toBe("flow_123");
    expect(result?.responses).toEqual([
      { type: "text", text: "Hello" },
    ]);
    expect(result?.completed).toBe(true);
    expect(result?.variables?.last_node_id).toBeNull(); // Completed flow marks last_node_id as null
  });
});
