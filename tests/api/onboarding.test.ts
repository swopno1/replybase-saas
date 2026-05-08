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
  summarizeOnboardingData: vi.fn().mockResolvedValue({
    companyProfile: "Test company",
    targetAudience: "SMEs",
    keyOfferings: "Software",
    commonQueries: "How does it work?",
    toneAndVoice: "Professional",
    conversionGoal: "lead_capture",
    preferredCta: "email",
    escalationPreference: "email",
    isPlaceholder: true,
  }),
  customizeFlowNodesWithAI: vi.fn().mockResolvedValue([
    { id: "test-node", type: "message", order: 1, content: { text: "Hello" } },
  ]),
  appendLeadGenerationNodes: vi.fn().mockImplementation(nodes => nodes),
  resolveTemplateCategory: vi.fn().mockReturnValue("saas"),
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

  it("POST completes onboarding with valid data (new schema)", async () => {
    const onboardingData = {
      business: {
        name: "John",
        company: "Acme",
        industry: "Software & Technology",
        subIndustry: "SaaS",
        website: "https://acme.com",
        businessModel: "B2B",
      },
      offer: {
        description: "We build project management software",
        targetCustomers: ["Small & Medium Businesses (B2B)"],
        mainProducts: "TaskFlow Pro - AI-powered project management",
      },
      chatbotGoals: {
        conversionGoal: "lead_capture",
        preferredCta: "email",
        botPersonality: "professional",
        escalationPreference: "email",
      },
      context: {
        commonQuestions: "How much does it cost? Is there a free trial?",
        otherInfo: "",
      },
    };

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(onboardingData),
    });

    const response = await POST(req as any, { params: Promise.resolve({}) });
    const result = await response.json();

    if (result.error) {
      console.error("Test received API error:", result.error, result.details);
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

  it("POST creates a bot when none exists", async () => {
    mockDb.bot.count.mockResolvedValue(0);

    const onboardingData = {
      business: {
        name: "Jane",
        company: "GreenClean",
        industry: "Home Services & Trades",
        subIndustry: "Cleaning",
        website: "",
        businessModel: "B2C",
      },
      offer: {
        description: "Professional house cleaning",
        targetCustomers: ["Local Consumers (B2C)"],
        mainProducts: "Deep cleaning, regular maintenance, move-in/out cleaning",
      },
      chatbotGoals: {
        conversionGoal: "booking",
        preferredCta: "call",
        botPersonality: "friendly",
        escalationPreference: "phone",
      },
      context: {
        commonQuestions: "What areas do you cover? How much per hour?",
      },
    };

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(onboardingData),
    });

    await POST(req as any, { params: Promise.resolve({}) });

    expect(mockDb.bot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "GreenClean AI Assistant",
        tenantId: mockTenantId,
        enabled: true,
      }),
    });
  });

  it("POST updates existing bots when they exist", async () => {
    mockDb.bot.count.mockResolvedValue(2);

    const onboardingData = {
      business: {
        name: "Mike",
        company: "LuxeCuts",
        industry: "Healthcare & Wellness",
        subIndustry: "MedSpas & Salons",
        website: "https://luxecuts.com",
        businessModel: "B2C",
      },
      offer: {
        description: "Premium hair salon",
        targetCustomers: ["Local Consumers (B2C)"],
        mainProducts: "Haircuts, coloring, styling, treatments",
      },
      chatbotGoals: {
        conversionGoal: "booking",
        preferredCta: "booking_link",
        botPersonality: "luxury",
        escalationPreference: "live_chat",
      },
      context: {
        commonQuestions: "Do you accept walk-ins? What are your hours?",
      },
    };

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(onboardingData),
    });

    await POST(req as any, { params: Promise.resolve({}) });

    expect(mockDb.bot.create).not.toHaveBeenCalled();
    expect(mockDb.bot.updateMany).toHaveBeenCalledWith({
      where: { tenantId: mockTenantId },
      data: expect.objectContaining({
        entryFlow: "mock-flow-id",
      }),
    });
  });

  it("POST returns 400 for invalid data", async () => {
    const invalidData = { business: { name: "" } }; // Missing required fields

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(invalidData),
    });

    const response = await POST(req as any, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
  });

  it("POST returns 400 for invalid conversion goal", async () => {
    const invalidData = {
      business: {
        name: "Test",
        company: "Test Co",
        industry: "Other",
        businessModel: "B2C",
      },
      offer: {
        description: "Testing",
        targetCustomers: [],
        mainProducts: "Test product",
      },
      chatbotGoals: {
        conversionGoal: "invalid_goal", // Invalid!
        preferredCta: "email",
        botPersonality: "friendly",
        escalationPreference: "email",
      },
      context: {
        commonQuestions: "Test",
      },
    };

    const req = new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify(invalidData),
    });

    const response = await POST(req as any, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
  });
});
