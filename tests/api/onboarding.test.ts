import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, POST } from "@/app/api/onboarding/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bot: {
      updateMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/onboarding-ai", () => ({
  summarizeOnboardingData: vi.fn().mockResolvedValue({ summary: "test summary" }),
}));

describe("Onboarding API", () => {
  const mockTenantId = "test-tenant-id";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { tenantId: mockTenantId, id: "test-user" },
      expires: "1234",
    });
  });

  it("GET returns tenant onboarding status", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: mockTenantId,
      isOnboarded: false,
      onboardingStep: 0,
      onboardingData: {},
      name: "Test Tenant",
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await GET();
    const data = await response.json();

    expect(data.isOnboarded).toBe(false);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: mockTenantId },
      select: expect.any(Object),
    });
  });

  it("PATCH updates onboarding progress", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
      id: mockTenantId,
      isOnboarded: false,
      onboardingStep: 0,
      onboardingData: { kyc: { name: "Old Name" } },
      name: "Test Tenant",
      stripeCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new Request("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 1,
        data: { kyc: { name: "New Name" } },
      }),
    });

    const response = await PATCH(req as unknown as Request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: mockTenantId },
      data: {
        onboardingStep: 1,
        onboardingData: { kyc: { name: "New Name" } },
      },
    });
  });

  it("POST completes onboarding and triggers AI summary", async () => {
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

    const response = await POST(req as unknown as Request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.summary.isPlaceholder).toBe(true);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: mockTenantId },
      data: {
        isOnboarded: true,
        onboardingData: {
          raw: onboardingData,
          summary: expect.objectContaining({ isPlaceholder: true }),
        },
      },
    });
  });
});
