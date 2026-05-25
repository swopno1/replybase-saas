import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/settings/api-keys/route";
import { NextRequest } from "next/server";
import { getTenantLimits } from "@/lib/subscription";
import { getPlanConfig } from "@/lib/plans";

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (handler: any) => async (req: any, ctx: any) => {
    const user = { id: "user_1", tenantId: "tenant_1", isAdmin: true };
    const db = {
      apiKey: {
        findMany: vi.fn().mockResolvedValue([{ id: "key_1", name: "Test Key" }]),
        create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: "new_key_id", createdAt: new Date() })),
      }
    };
    return handler(user, req, ctx, db);
  }
}));

vi.mock("@/lib/subscription", () => ({
  getTenantLimits: vi.fn(),
}));

vi.mock("@/lib/plans", () => ({
  getPlanConfig: vi.fn(),
}));

describe("Settings API Keys Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should return list of keys", async () => {
    const req = new NextRequest("http://localhost/api/settings/api-keys");
    const res = await GET(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Test Key");
  });

  it("POST should block creation if plan lacks apiAccess", async () => {
    (getTenantLimits as any).mockResolvedValue({ name: "free" });
    (getPlanConfig as any).mockReturnValue({ apiAccess: false });

    const req = new NextRequest("http://localhost/api/settings/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "New Key" })
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("requires Scale or Business");
  });

  it("POST should create key if plan has apiAccess", async () => {
    (getTenantLimits as any).mockResolvedValue({ name: "business" });
    (getPlanConfig as any).mockReturnValue({ apiAccess: true, displayName: "Business" });

    const req = new NextRequest("http://localhost/api/settings/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "New Key" })
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New Key");
    expect(data.key).toBeDefined();
    expect(data.key).toContain("rb_live_");
  });
});
