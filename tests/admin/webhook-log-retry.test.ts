import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as retryWebhookLog } from "@/app/api/admin/webhook-logs/[id]/retry/route";
import { getServerSession } from "next-auth";
import { logAdminActivity } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

vi.mock("next-auth");
vi.mock("next-auth/next");

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookLog: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  logAdminActivity: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isPlatformAdmin: vi.fn((session) => session?.user?.role === "ADMIN"),
}));

vi.mock("@/lib/services/webhook-dispatcher", () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(undefined),
}));

const makeRequest = () =>
  new NextRequest("http://localhost/api/admin/webhook-logs/log-1/retry", {
    method: "POST",
    headers: {
      "user-agent": "test-agent",
      "x-forwarded-for": "127.0.0.1",
    },
  });

const adminSession = {
  user: { id: "admin-1", role: "ADMIN" },
};

describe("Webhook Log Retry Endpoint POST /api/admin/webhook-logs/[id]/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 403 if not a platform admin", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-1", role: "USER" },
    });

    const res = await retryWebhookLog(makeRequest(), {
      params: Promise.resolve({ id: "log-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("should return 404 if the webhook log is not found", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession);
    vi.mocked((prisma as any).webhookLog.findUnique).mockResolvedValueOnce(null);

    const res = await retryWebhookLog(makeRequest(), {
      params: Promise.resolve({ id: "missing-log" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("should return 422 if the log has no tenantId", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession);
    vi.mocked((prisma as any).webhookLog.findUnique).mockResolvedValueOnce({
      id: "log-1",
      tenantId: null,
      event: "lead.created",
      data: { leadId: "l-1" },
      source: "facebook",
      createdAt: new Date(),
    });

    const res = await retryWebhookLog(makeRequest(), {
      params: Promise.resolve({ id: "log-1" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/tenant/i);
  });

  it("should return 422 if the log has no event type", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession);
    vi.mocked((prisma as any).webhookLog.findUnique).mockResolvedValueOnce({
      id: "log-1",
      tenantId: "tenant-1",
      event: null,
      data: { leadId: "l-1" },
      source: "facebook",
      createdAt: new Date(),
    });

    const res = await retryWebhookLog(makeRequest(), {
      params: Promise.resolve({ id: "log-1" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/event type/i);
  });

  it("should successfully replay a valid webhook log entry", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(adminSession);
    const logEntry = {
      id: "log-1",
      tenantId: "tenant-1",
      event: "lead.created",
      data: { leadId: "l-1", name: "John" },
      source: "whatsapp",
      createdAt: new Date("2026-05-20T10:00:00Z"),
    };
    vi.mocked((prisma as any).webhookLog.findUnique).mockResolvedValueOnce(logEntry);

    const res = await retryWebhookLog(makeRequest(), {
      params: Promise.resolve({ id: "log-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.event).toBe("lead.created");
    expect(body.logId).toBe("log-1");

    // Verify dispatchWebhook was called with the correct args
    const { dispatchWebhook } = await import("@/lib/services/webhook-dispatcher");
    expect(dispatchWebhook).toHaveBeenCalledWith(
      "tenant-1",
      "lead.created",
      logEntry.data,
    );

    // Verify audit log was written
    expect(logAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WEBHOOK_LOG_REPLAYED",
        entityId: "log-1",
        entityType: "WEBHOOK_LOG",
      }),
    );
  });
});
