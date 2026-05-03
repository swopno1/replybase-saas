import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../../app/api/onboarding/route";
import { getServerSession } from "next-auth";
import { prisma } from "../../lib/prisma";
import { getTenantPrisma } from "../../lib/prisma-tenant";

vi.mock("next-auth");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma-tenant", () => ({
  getTenantPrisma: vi.fn(),
}));

const mockDb = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: "mock-tenant-id" }),
  },
  bot: {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: "mock-bot-id" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  flow: {
    create: vi.fn().mockResolvedValue({ id: "mock-flow-id" }),
  },
};

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (fn: any) => async (request: any, context: any) => {
    return fn({ tenantId: "test-tenant-id", id: "test-user-id" }, request, context, mockDb);
  },
}));

vi.mock("@/lib/onboarding-ai", () => ({
  summarizeOnboardingData: vi.fn().mockResolvedValue({ isPlaceholder: true, summary: "test summary" }),
  customizeFlowNodesWithAI: vi.fn().mockResolvedValue([{ id: "test-node", type: "message", order: 1, content: {} }]),
  appendLeadGenerationNodes: vi.fn().mockImplementation(nodes => nodes),
}));

describe("Onboarding API", () => {
  const mockTenantId = "test-tenant-id";
  const mockUserId = "test-user-id";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: mockUserId, tenantId: mockTenantId },
      expires: "1234",
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: mockUserId,
      tenantId: mockTenantId,
    } as any);

    vi.mocked(getTenantPrisma).mockReturnValue(mockDb as any);

    // Ensure default resolved values for safety
    mockDb.tenant.update.mockResolvedValue({ id: mockTenantId });
    mockDb.bot.count.mockResolvedValue(0);
    mockDb.bot.create.mockResolvedValue({ id: "mock-bot-id" });
  });

  it("GET returns tenant onboarding status", async () => {
    mockDb.tenant.findUnique.mockResolvedValue({
      id: mockTenantId,
      isOnboarded: false,
      onboardingStep: 0,
      onboardingData: {},
    });

    const response = await GET(new Request("http://localhost") as any, { params: Promise.resolve({}) });
    const result = await response.json();

    expect(result.data.isOnboarded).toBe(false);
    expect(mockDb.tenant.findUnique).toHaveBeenCalled();
  });

  it("POST completes onboarding with valid data", async () => {
    const onboardingData = {
      kyc: { name: "John", company: "Acme", contactInfo: "john@acme.com", location: "US" },
      businessBasics: { industry: "Tech", companySize: "10-50", website: "https://acme.com", businessModel: "SaaS" },
      productDetails: { offer: "Software", targetCustomers: ["SMEs"] },
      productSpecifics: { mainProducts: "App", pricing: "$10", usps: "Fast" },
      supportSales: { commonQuestions: "How?", painPoints: "None", salesProcess: "Direct" },
      additionalContext: { otherInfo: "None" },
    };

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(onboardingData),
    });

    const response = await POST(req as any, { params: Promise.resolve({}) });
    const result = await response.json();

    if (result.error) {
        console.error('Test received API error:', result.error, result.details);
    }

    expect(result.data).toBeDefined();
    expect(result.data.success).toBe(true);
    expect(mockDb.tenant.update).toHaveBeenCalledWith({
      where: { id: mockTenantId },
      data: expect.objectContaining({
        isOnboarded: true,
      }),
    });
  });

  it("POST returns 400 for invalid data", async () => {
    const invalidData = { kyc: { name: "" } }; // Missing required fields

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(invalidData),
    });

    const response = await POST(req as any, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
  });
});
