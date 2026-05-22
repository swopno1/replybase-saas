import { prismaMock } from "../mocks/prisma";
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { NextRequest } from "next/server";
import { GET as getContacts, DELETE as deleteContacts } from "@/app/api/contacts/route";
import { GET as getConversations, DELETE as deleteConversations } from "@/app/api/conversations/route";
import { describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (fn: (...args: unknown[]) => unknown) => async (request: unknown, context: unknown) => {
    return fn({ tenantId: "test-tenant", id: "test-user" }, request, context, prismaMock);
  },
}));

describe("Contacts & Conversations API Batch Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DELETE contacts should support 'ALL'", async () => {
    const req = new NextRequest("http://localhost/api/contacts", {
      method: "DELETE",
      body: JSON.stringify({ ids: "ALL" }),
    });
    prismaMock.contact.deleteMany.mockResolvedValue({ count: 50 });

    const res = await deleteContacts(req, { params: Promise.resolve({}) });
    const result = await res.json();
    const data = result.data;

    expect(prismaMock.contact.deleteMany).toHaveBeenCalledWith({
      where: {},
    });
    expect(data.count).toBe(50);
  });

  it("DELETE conversations should support 'ALL'", async () => {
    const req = new NextRequest("http://localhost/api/conversations", {
      method: "DELETE",
      body: JSON.stringify({ ids: "ALL" }),
    });
    prismaMock.crmConversation.deleteMany.mockResolvedValue({ count: 30 });

    const res = await deleteConversations(req, { params: Promise.resolve({}) });
    const result = await res.json();
    const data = result.data;

    expect(prismaMock.crmConversation.deleteMany).toHaveBeenCalledWith({
      where: {},
    });
    expect(data.count).toBe(30);
  });
});
