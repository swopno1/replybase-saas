import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dataDeletionRequest: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { POST } from "@/app/api/data-deletion/request/route";
import { NextRequest } from "next/server";

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/data-deletion/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const mockCreatedRequest = {
  email: "user@example.com",
  confirmationCode: "del_abc123",
  cancelToken: "cancel_xyz456",
  scheduledDeletionAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  status: "PENDING",
};

describe("POST /api/data-deletion/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://app.replybase.co.uk";
  });

  it("returns 401 when neither session nor API key provided", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: false, source: "none" });
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = makeRequest({ email: "user@example.com" });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 400 when no email and no session email", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: true, source: "api-key" });
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = makeRequest({});
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("email");
  });

  it("returns 400 when email is malformed", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: true, source: "api-key" });
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = makeRequest({ email: "not-an-email" });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("email");
  });

  it("creates deletion request via API key auth and returns confirmation details", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: true, source: "api-key" });
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(prisma.dataDeletionRequest.create).mockResolvedValue(
      mockCreatedRequest as never,
    );

    const req = makeRequest({ email: "user@example.com", source: "marketing" });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.email).toBe("user@example.com");
    expect(data.confirmationCode).toBe("del_abc123");
    expect(data.statusUrl).toContain("del_abc123");
    expect(data.cancelUrl).toContain("cancel_xyz456");
    expect(data.source).toBe("api-key");
    expect(prisma.dataDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "user@example.com",
          source: "marketing",
        }),
      }),
    );
  });

  it("creates deletion request via session auth using session email", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: false, source: "none" });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user_1", email: "session@example.com", tenantId: "tenant_1" },
    } as never);
    vi.mocked(prisma.dataDeletionRequest.create).mockResolvedValue({
      ...mockCreatedRequest,
      email: "session@example.com",
    } as never);

    const req = makeRequest({});
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.email).toBe("session@example.com");
    expect(data.source).toBe("session");
    expect(prisma.dataDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "session@example.com",
          userId: "user_1",
          tenantId: "tenant_1",
        }),
      }),
    );
  });

  it("uses provided email over session email when API key is used", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: true, source: "api-key" });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user_1", email: "session@example.com", tenantId: "tenant_1" },
    } as never);
    vi.mocked(prisma.dataDeletionRequest.create).mockResolvedValue({
      ...mockCreatedRequest,
      email: "provided@example.com",
    } as never);

    const req = makeRequest({ email: "provided@example.com" });
    await POST(req);

    expect(prisma.dataDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "provided@example.com" }),
      }),
    );
  });

  it("sets a 7-day scheduled deletion window", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: true, source: "api-key" });
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(prisma.dataDeletionRequest.create).mockResolvedValue(
      mockCreatedRequest as never,
    );

    const before = Date.now();
    await POST(makeRequest({ email: "user@example.com" }));
    const after = Date.now();

    const createCall = vi.mocked(prisma.dataDeletionRequest.create).mock.calls[0][0];
    const scheduled = (createCall.data as any).scheduledDeletionAt as Date;
    const diff = scheduled.getTime() - before;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(diff).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
    expect(diff).toBeLessThanOrEqual(sevenDaysMs + (after - before) + 1000);
  });

  it("returns 500 on DB error", async () => {
    vi.mocked(validateApiKey).mockReturnValue({ authenticated: true, source: "api-key" });
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(prisma.dataDeletionRequest.create).mockRejectedValue(
      new Error("DB unavailable"),
    );

    const req = makeRequest({ email: "user@example.com" });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal Server Error");
  });
});
