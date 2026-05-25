import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashApiKey, generateApiKey } from "@/lib/api-keys";
import { withApiKey } from "@/lib/route-helpers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantLimits } from "@/lib/subscription";
import { getPlanConfig } from "@/lib/plans";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    tenant: {
      findUnique: vi.fn(),
    }
  },
}));

vi.mock("@/lib/subscription", () => ({
  getTenantLimits: vi.fn(),
}));

vi.mock("@/lib/plans", () => ({
  getPlanConfig: vi.fn(),
}));

vi.mock("@/lib/prisma-tenant", () => ({
  getTenantPrisma: vi.fn().mockReturnValue({}),
}));

vi.mock("@sentry/nextjs", () => ({
  setTag: vi.fn(),
}));

describe("withApiKey MiddleWare", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if X-API-Key is missing", async () => {
    const handler = vi.fn();
    const middleware = withApiKey(handler);
    const req = new NextRequest("http://localhost/api/v1/health");

    const res = await middleware(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("API Key required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should return 401 if API Key is invalid", async () => {
    const handler = vi.fn();
    const middleware = withApiKey(handler);
    const req = new NextRequest("http://localhost/api/v1/health", {
      headers: { "X-API-Key": "invalid_key" }
    });

    (prisma.apiKey.findUnique as any).mockResolvedValue(null);

    const res = await middleware(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Invalid or inactive API Key");
  });

  it("should return 403 if plan does not support API access", async () => {
    const handler = vi.fn();
    const middleware = withApiKey(handler);
    const req = new NextRequest("http://localhost/api/v1/health", {
      headers: { "X-API-Key": "rb_live_test" }
    });

    (prisma.apiKey.findUnique as any).mockResolvedValue({ tenantId: "tenant_1", id: "key_1" });
    (getTenantLimits as any).mockResolvedValue({ name: "launch" });
    (getPlanConfig as any).mockReturnValue({ displayName: "Launch", apiAccess: false });

    const res = await middleware(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("API access is not available");
  });

  it("should call handler if API Key and plan are valid", async () => {
    const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const middleware = withApiKey(handler);
    const req = new NextRequest("http://localhost/api/v1/health", {
      headers: { "X-API-Key": "rb_live_test" }
    });

    (prisma.apiKey.findUnique as any).mockResolvedValue({ tenantId: "tenant_1", id: "key_1" });
    (getTenantLimits as any).mockResolvedValue({ name: "scale" });
    (getPlanConfig as any).mockReturnValue({ displayName: "Scale", apiAccess: true });

    const res = await middleware(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith("tenant_1", expect.anything(), expect.anything(), expect.anything());
  });
});
