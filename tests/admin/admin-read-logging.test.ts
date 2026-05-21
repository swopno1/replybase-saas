import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getTenant } from "@/app/api/admin/tenants/[id]/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { GET as getSubscriber } from "@/app/api/admin/subscribers/[id]/route";
import { GET as getSubscribers } from "@/app/api/admin/subscribers/route";
import { GET as getWebhookLogs } from "@/app/api/admin/webhook-logs/route";
import { getServerSession } from "next-auth";
import { logAdminActivity } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

vi.mock("next-auth");
vi.mock("next-auth/next");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    webhookLog: {
      findMany: vi.fn(),
    },
    executionLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  logAdminActivity: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isPlatformAdmin: vi.fn((session) => session?.user?.role === "ADMIN"),
}));

describe("Admin Read-Only Audit Logging GET Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin_123", role: "ADMIN" },
    } as any);
  });

  it("should log TENANT_READ when fetching tenant details", async () => {
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant_abc" } as any);

    const req = new NextRequest("http://localhost/api/admin/tenants/tenant_abc", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "test-agent",
      },
    });

    const res = await getTenant(req, { params: Promise.resolve({ id: "tenant_abc" }) });
    expect(res.status).toBe(200);

    expect(logAdminActivity).toHaveBeenCalledWith({
      adminId: "admin_123",
      action: "TENANT_READ",
      entityType: "TENANT",
      entityId: "tenant_abc",
      description: "Admin read tenant details for tenant ID: tenant_abc",
      metadata: { tenantId: "tenant_abc" },
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });
  });

  it("should log USERS_INDEX_READ when listing users", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/admin/users?search=bob&role=ADMIN&page=2&limit=5", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "test-agent",
      },
    });

    const res = await getUsers(req);
    expect(res.status).toBe(200);

    expect(logAdminActivity).toHaveBeenCalledWith({
      adminId: "admin_123",
      action: "USERS_INDEX_READ",
      entityType: "USER",
      description: 'Admin listed users with search: "bob", role: "ADMIN", page: 2, limit: 5',
      metadata: { search: "bob", role: "ADMIN", page: 2, limit: 5 },
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });
  });

  it("should log SUBSCRIBER_READ when fetching subscriber details", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: "sub_123",
      tenantId: "tenant_123",
      plan: { name: "Growth" },
      tenant: {
        bots: [],
      },
    } as any);

    const req = new NextRequest("http://localhost/api/admin/subscribers/sub_123", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "test-agent",
      },
    });

    const res = await getSubscriber(req, { params: Promise.resolve({ id: "sub_123" }) });
    expect(res.status).toBe(200);

    expect(logAdminActivity).toHaveBeenCalledWith({
      adminId: "admin_123",
      action: "SUBSCRIBER_READ",
      entityType: "SUBSCRIBER",
      entityId: "sub_123",
      description: "Admin read subscriber details for: sub_123",
      metadata: { id: "sub_123" },
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });
  });

  it("should log SUBSCRIBERS_INDEX_READ when listing subscribers", async () => {
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tenant.count).mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/admin/subscribers?search=corp&status=active&page=1&limit=10", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "test-agent",
      },
    });

    const res = await getSubscribers(req);
    expect(res.status).toBe(200);

    expect(logAdminActivity).toHaveBeenCalledWith({
      adminId: "admin_123",
      action: "SUBSCRIBERS_INDEX_READ",
      entityType: "SUBSCRIBER",
      description: 'Admin listed subscribers with search: "corp", status: "active", page: 1, limit: 10',
      metadata: { search: "corp", status: "active", page: 1, limit: 10 },
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });
  });

  it("should log WEBHOOK_LOGS_READ when fetching webhook logs", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    (prisma as any).webhookLog = { findMany: mockFindMany };

    const req = new NextRequest("http://localhost/api/admin/webhook-logs", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "test-agent",
      },
    });

    const res = await getWebhookLogs(req);
    expect(res.status).toBe(200);

    expect(logAdminActivity).toHaveBeenCalledWith({
      adminId: "admin_123",
      action: "WEBHOOK_LOGS_READ",
      entityType: "WEBHOOK_LOG",
      description: "Admin viewed recent webhook logs",
      metadata: { limit: 50 },
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });
  });
});
