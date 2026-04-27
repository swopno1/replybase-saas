import { NextRequest } from "next/server";
import { GET as getContacts, DELETE as deleteContacts } from "@/app/api/contacts/route";
import { GET as getConversations, DELETE as deleteConversations } from "@/app/api/conversations/route";
import { prisma } from "@/lib/prisma";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    crmConversation: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (fn: any) => async (request: any, context: any) => {
    return fn({ tenantId: "test-tenant", id: "test-user" }, request, context);
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
    (prisma.contact.deleteMany as any).mockResolvedValue({ count: 50 });

    const res = await deleteContacts(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prisma.contact.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: "test-tenant",
      },
    });
    expect(data.count).toBe(50);
  });

  it("DELETE conversations should support 'ALL'", async () => {
    const req = new NextRequest("http://localhost/api/conversations", {
      method: "DELETE",
      body: JSON.stringify({ ids: "ALL" }),
    });
    (prisma.crmConversation.deleteMany as any).mockResolvedValue({ count: 30 });

    const res = await deleteConversations(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prisma.crmConversation.deleteMany).toHaveBeenCalledWith({
      where: {
        contact: {
          tenantId: "test-tenant",
        },
      },
    });
    expect(data.count).toBe(30);
  });
});
