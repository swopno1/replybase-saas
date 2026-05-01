import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, POST } from "../../app/api/onboarding/route";
import { getServerSession } from "next-auth";
import { prisma } from "../../lib/prisma";
import { getTenantPrisma } from "../../lib/prisma-tenant";

vi.mock("next-auth");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bot: {
      updateMany: vi.fn(),
    },
    flow: {
      create: vi.fn().mockResolvedValue({ id: "mock-flow-id" }),
    },
  },
}));

vi.mock("@/lib/prisma-tenant", () => ({
  getTenantPrisma: vi.fn().mockReturnValue({
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bot: {
      updateMany: vi.fn(),
    },
    flow: {
      create: vi.fn().mockResolvedValue({ id: "mock-flow-id" }),
    },
  }),
}));

vi.mock("@/lib/onboarding-ai", () => ({
  summarizeOnboardingData: vi.fn().mockResolvedValue({ isPlaceholder: true, summary: "test summary" }),
  customizeFlowNodesWithAI: vi.fn().mockResolvedValue([{ id: "test-node" }]),
}));

describe("Onboarding API", () => {
  const mockTenantId = "test-tenant-id";
  const mockUserId = "test-user-id";
  let mockDb: any;

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

    mockDb = getTenantPrisma(mockTenantId);
  });

  it("GET returns tenant onboarding status", async () => {
    vi.mocked(mockDb.tenant.findUnique).mockResolvedValue({
      id: mockTenantId,
      isOnboarded: false,
      onboardingStep: 0,
      onboardingData: {},
    });

    const response = await GET(new Request("http://localhost") as any, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(data.isOnboarded).toBe(false);
    expect(mockDb.tenant.findUnique).toHaveBeenCalled();
  });

  it("POST completes onboarding with valid data", async () => {
    const onboardingData = {
      kyc: { name: "John", company: "Acme", contactInfo: "john@acme.com", location: "US" },
      businessBasics: { industry: "Tech", companySize: "10-50", website: "https://acme.com", businessModel: "SaaS" },
      productDetails: { offer: "Software", targetCustomers: "SMEs" },
      productSpecifics: { mainProducts: "App", pricing: "$10", usps: "Fast" },
      supportSales: { commonQuestions: "How?", painPoints: "None", salesProcess: "Direct" },
      additionalContext: { otherInfo: "None" },
    };

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(onboardingData),
    });

    const response = await POST(req as any, { params: Promise.resolve({}) });
    const data = await response.json();

    expect(data.success).toBe(true);
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
