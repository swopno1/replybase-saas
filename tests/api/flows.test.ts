import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFlow = {
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
};

const mockSubscription = {
  findUnique: vi.fn(),
};

const mockUser = {
  findUnique: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flow: {
      findMany: (...args: any[]) => mockFlow.findMany(...args),
      count: (...args: any[]) => mockFlow.count(...args),
      create: (...args: any[]) => mockFlow.create(...args),
    },
    subscription: {
      findUnique: (...args: any[]) => mockSubscription.findUnique(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUser.findUnique(...args),
      count: (...args: any[]) => mockUser.count(...args),
      update: (...args: any[]) => mockUser.update(...args),
    },
  },
}));

const mockActiveUser = { tenantId: "test-tenant", id: "test-user" };

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (fn: any) => async (request: any, context: any) => {
    return fn(
      mockActiveUser,
      request,
      context,
      {
        flow: {
          findMany: (...args: any[]) => mockFlow.findMany(...args),
          count: (...args: any[]) => mockFlow.count(...args),
          create: (...args: any[]) => mockFlow.create(...args),
        },
        subscription: {
          findUnique: (...args: any[]) => mockSubscription.findUnique(...args),
        },
        user: {
          findUnique: (...args: any[]) => mockUser.findUnique(...args),
          count: (...args: any[]) => mockUser.count(...args),
          update: (...args: any[]) => mockUser.update(...args),
        },
      } as any
    );
  },
}));

// Now import the handlers
import { GET, POST } from "@/app/api/flows/route";
import { NextRequest } from "next/server";

describe("Flows API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveUser.tenantId = "test-tenant";
    mockActiveUser.id = "test-user";
  });

  describe("GET /api/flows", () => {
    it("should return only tenant flows when type=my", async () => {
      const req = new NextRequest("http://localhost/api/flows?type=my");
      const mockFlowsList = [
        { id: "flow-1", name: "Flow 1", isGlobal: false, tenantId: "test-tenant" },
      ];
      mockFlow.findMany.mockResolvedValue(mockFlowsList);

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.flows).toEqual(mockFlowsList);
      expect(mockFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: "test-tenant",
            isGlobal: false,
          },
        })
      );
    });

    it("should return global flows when type=global", async () => {
      const req = new NextRequest("http://localhost/api/flows?type=global");
      const mockFlowsList = [
        { id: "flow-g", name: "Global Flow", isGlobal: true, tenantId: "admin-tenant" },
      ];
      mockFlow.findMany.mockResolvedValue(mockFlowsList);

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.flows).toEqual(mockFlowsList);
      expect(mockFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isGlobal: true,
          },
        })
      );
    });

    it("should return mixed list by default when type query param is not my or global", async () => {
      const req = new NextRequest("http://localhost/api/flows");
      const mockFlowsList = [
        { id: "flow-1", name: "Flow 1", isGlobal: false, tenantId: "test-tenant" },
        { id: "flow-g", name: "Global Flow", isGlobal: true, tenantId: "admin-tenant" },
      ];
      mockFlow.findMany.mockResolvedValue(mockFlowsList);

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.flows).toEqual(mockFlowsList);
      expect(mockFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ tenantId: "test-tenant" }, { isGlobal: true }],
          },
        })
      );
    });

    it("should filter by isActive if query parameter is provided", async () => {
      const req = new NextRequest("http://localhost/api/flows?isActive=true");
      const mockFlowsList = [
        { id: "flow-1", name: "Flow 1", isGlobal: false, isActive: true, tenantId: "test-tenant" },
      ];
      mockFlow.findMany.mockResolvedValue(mockFlowsList);

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      expect(mockFlow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ tenantId: "test-tenant" }, { isGlobal: true }],
            isActive: true,
          },
        })
      );
    });

    it("should handle error during flows fetching", async () => {
      const req = new NextRequest("http://localhost/api/flows");
      mockFlow.findMany.mockRejectedValue(new Error("Database error"));

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe("Failed to fetch flows");
    });
  });

  describe("POST /api/flows", () => {
    it("should create a new flow within the plan limits", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({
          name: "Flow 1",
          description: "Desc",
          nodes: [{ type: "message", content: { text: "Hello" } }],
        }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(1);
      mockUser.findUnique.mockResolvedValue({ isAdmin: false });
      
      const mockCreatedFlow = {
        id: "new-flow-id",
        name: "Flow 1",
        description: "Desc",
        tenantId: "test-tenant",
        ownerId: "test-user",
        isGlobal: false,
      };
      mockFlow.create.mockResolvedValue(mockCreatedFlow);

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.flow).toEqual(mockCreatedFlow);

      expect(mockSubscription.findUnique).toHaveBeenCalledWith({
        where: { tenantId: "test-tenant" },
        include: { plan: true },
      });

      expect(mockFlow.count).toHaveBeenCalledWith({
        where: {
          tenantId: "test-tenant",
          ownerId: "test-user",
          isGlobal: false,
        },
      });

      expect(mockFlow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Flow 1",
          description: "Desc",
          tenantId: "test-tenant",
          ownerId: "test-user",
          isGlobal: false,
          language: "en",
          fallbackMessage: "Sorry, I didn't understand that.",
          nodes: {
            create: [
              {
                type: "message",
                content: { text: "Hello" },
                order: 0,
              },
            ],
          },
        }),
        include: {
          nodes: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });
    });

    it("should return 403 when no active subscription is found", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Flow 1" }),
      });

      mockSubscription.findUnique.mockResolvedValue(null);

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toBe("No active subscription found");
      expect(mockFlow.create).not.toHaveBeenCalled();
    });

    it("should return 403 when plan limit has been reached", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Flow 1" }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(3);

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toContain("Flow limit reached");
      expect(mockFlow.create).not.toHaveBeenCalled();
    });

    it("should return 400 when flow name is missing", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(1);

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe("Flow name is required");
      expect(mockFlow.create).not.toHaveBeenCalled();
    });

    it("should allow an admin to create a global template flow", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Global Flow", isGlobal: true }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(1);
      mockUser.findUnique.mockResolvedValue({ isAdmin: true });
      
      const mockCreatedFlow = {
        id: "global-flow-id",
        name: "Global Flow",
        tenantId: "test-tenant",
        ownerId: "test-user",
        isGlobal: true,
      };
      mockFlow.create.mockResolvedValue(mockCreatedFlow);

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.flow).toEqual(mockCreatedFlow);
      expect(mockFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGlobal: true,
          }),
        })
      );
    });

    it("should restrict non-admin from creating global template flow", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Global Flow", isGlobal: true }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(1);
      mockUser.findUnique.mockResolvedValue({ isAdmin: false });
      mockUser.count.mockResolvedValue(1); // There are other admin users

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toBe("Only admin users can create global template flows");
      expect(mockFlow.create).not.toHaveBeenCalled();
    });

    it("should auto-promote a user to admin if they try to create a global flow and no admins exist", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Global Flow", isGlobal: true }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(1);
      mockUser.findUnique.mockResolvedValue({ isAdmin: false });
      mockUser.count.mockResolvedValue(0); // No admin users exist
      mockUser.update.mockResolvedValue({ id: "test-user", isAdmin: true });
      
      const mockCreatedFlow = {
        id: "global-flow-id",
        name: "Global Flow",
        tenantId: "test-tenant",
        ownerId: "test-user",
        isGlobal: true,
      };
      mockFlow.create.mockResolvedValue(mockCreatedFlow);

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(201);

      expect(mockUser.update).toHaveBeenCalledWith({
        where: { id: "test-user" },
        data: { isAdmin: true },
      });
      expect(mockFlow.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGlobal: true,
          }),
        })
      );
    });

    it("should handle error during flow creation", async () => {
      const req = new NextRequest("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ name: "Flow 1" }),
      });

      mockSubscription.findUnique.mockResolvedValue({
        tenantId: "test-tenant",
        plan: { maxFlows: 3 },
      });

      mockFlow.count.mockResolvedValue(1);
      mockUser.findUnique.mockResolvedValue({ isAdmin: false });
      mockFlow.create.mockRejectedValue(new Error("Database write error"));

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(500);

      const data = await res.json();
      expect(data.error).toBe("Failed to create flow");
    });
  });
});
