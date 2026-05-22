import { prismaMock } from "../mocks/prisma";
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { NextRequest } from "next/server";
import { GET, DELETE, PATCH } from "@/app/api/leads/route";
import { describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (fn: any) => async (request: any, context: any) => {
    return fn({ tenantId: "test-tenant", id: "test-user" }, request, context, prismaMock);
  },
}));

describe("Leads API Batch Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET should support pagination", async () => {
    const req = new NextRequest("http://localhost/api/leads?page=2&limit=10");
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.lead.count.mockResolvedValue(25);
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    const res = await GET(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prismaMock.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
    }));
    expect(data.totalCount).toBe(25);
    expect(data.totalPages).toBe(3);
    expect(data.currentPage).toBe(2);
  });

  it("DELETE should perform batch delete with specific IDs", async () => {
    const req = new NextRequest("http://localhost/api/leads", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["1", "2"] }),
    });
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 2 });

    const res = await DELETE(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prismaMock.lead.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["1", "2"] },
        tenantId: "test-tenant",
      },
    });
    expect(data.count).toBe(2);
  });

  it("DELETE should perform batch delete with 'ALL'", async () => {
    const req = new NextRequest("http://localhost/api/leads", {
      method: "DELETE",
      body: JSON.stringify({ ids: "ALL" }),
    });
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 100 });

    const res = await DELETE(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prismaMock.lead.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: "test-tenant",
      },
    });
    expect(data.count).toBe(100);
  });

  it("PATCH should perform batch status update with 'ALL'", async () => {
    const req = new NextRequest("http://localhost/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ ids: "ALL", status: "qualified" }),
    });
    prismaMock.lead.updateMany.mockResolvedValue({ count: 100 });

    const res = await PATCH(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prismaMock.lead.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "test-tenant",
      },
      data: { status: "qualified" },
    });
    expect(data.count).toBe(100);
  });
});
