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
  },
}));
vi.mock("@/lib/onboarding-ai", () => ({
  summarizeOnboardingData: vi.fn().mockResolvedValue({ summary: "test summary" }),
}));

describe("Onboarding API", () => {
  const mockTenantId = "test-tenant-id";

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({
      user: { tenantId: mockTenantId },
    });
  });

  it("GET returns tenant onboarding status", async () => {
    (prisma.tenant.findUnique as any).mockResolvedValue({
      isOnboarded: false,
      onboardingStep: 0,
      onboardingData: {},
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
    (prisma.tenant.findUnique as any).mockResolvedValue({
      onboardingData: { kyc: { name: "Old Name" } },
    });

    const req = new Request("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 1,
        data: { kyc: { name: "New Name" } },
      }),
    });

    const response = await PATCH(req as any);
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

    const response = await POST(req as any);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.summary).toEqual({ summary: "test summary" });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: mockTenantId },
      data: {
        isOnboarded: true,
        onboardingData: {
          raw: onboardingData,
          summary: { summary: "test summary" },
        },
      },
    });
  });
});
