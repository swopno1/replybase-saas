import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { DELETE } from "@/app/api/users/account/route";

describe("DELETE /api/users/account", () => {
  const mockSession = {
    user: {
      id: "user_1",
      tenantId: "tenant_1",
      email: "user@example.com",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when user record not found in DB", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("User not found");
  });

  it("returns 500 when transaction throws", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      tenantId: "tenant_1",
    } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error("DB connection lost"),
    );

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal Server Error");
  });

  it("deletes only user-scoped data when tenant has multiple users", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      tenantId: "tenant_1",
    } as never);

    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(2),
        delete: vi.fn().mockResolvedValue({ id: "user_1" }),
      },
      executionLog: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      internalNote: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      crmMessage: { deleteMany: vi.fn() },
      crmConversation: { 
        deleteMany: vi.fn(),
        updateMany: vi.fn()
      },
      contactIdentity: { deleteMany: vi.fn() },
      lead: { deleteMany: vi.fn() },
      channel: { deleteMany: vi.fn() },
      webChatSite: { deleteMany: vi.fn() },
      facebookPage: { deleteMany: vi.fn() },
      flow: { deleteMany: vi.fn() },
      contact: { deleteMany: vi.fn() },
      usageLog: { 
        deleteMany: vi.fn(),
        updateMany: vi.fn()
      },
      bot: { deleteMany: vi.fn() },
      onboardingSession: { deleteMany: vi.fn() },
      onboardingMetrics: { deleteMany: vi.fn() },
      tenant: { delete: vi.fn() },
      adminActivity: { 
        updateMany: vi.fn(),
        deleteMany: vi.fn()
      },
      passwordResetToken: { deleteMany: vi.fn() },
      activityLog: { updateMany: vi.fn() },
      churnFeedback: { updateMany: vi.fn() },
      newsletterSubscriber: { updateMany: vi.fn() },
      dataDeletionRequest: { updateMany: vi.fn() },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn(tx as never),
    );

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      deletedScope: "user",
      redirectTo: "/auth/login?accountDeleted=1",
    });

    expect(tx.executionLog.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_1" },
    });
    expect(tx.internalNote.deleteMany).toHaveBeenCalledWith({
      where: { authorId: "user_1" },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user_1" } });

    expect(tx.crmConversation.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenant.delete).not.toHaveBeenCalled();
  });

  it("deletes tenant-scoped data when deleting the last tenant user", async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      tenantId: "tenant_1",
    } as never);

    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(1),
        delete: vi.fn().mockResolvedValue({ id: "user_1" }),
      },
      executionLog: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      internalNote: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      crmMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      crmConversation: { 
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn()
      },
      contactIdentity: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      lead: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      channel: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      webChatSite: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      facebookPage: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      flow: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      contact: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      usageLog: { 
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn()
      },
      bot: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      onboardingSession: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      onboardingMetrics: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      tenant: { delete: vi.fn().mockResolvedValue({ id: "tenant_1" }) },
      adminActivity: { 
        updateMany: vi.fn(),
        deleteMany: vi.fn()
      },
      passwordResetToken: { deleteMany: vi.fn() },
      activityLog: { updateMany: vi.fn() },
      churnFeedback: { updateMany: vi.fn() },
      newsletterSubscriber: { updateMany: vi.fn() },
      dataDeletionRequest: { updateMany: vi.fn() },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn(tx as never),
    );

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      deletedScope: "tenant",
      redirectTo: "/auth/login?accountDeleted=1",
    });

    expect(tx.crmMessage.deleteMany).toHaveBeenCalled();
    expect(tx.crmConversation.deleteMany).toHaveBeenCalled();
    expect(tx.contactIdentity.deleteMany).toHaveBeenCalled();
    expect(tx.lead.deleteMany).toHaveBeenCalled();
    expect(tx.tenant.delete).toHaveBeenCalledWith({
      where: { id: "tenant_1" },
    });
  });
});
