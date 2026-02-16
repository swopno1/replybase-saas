import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/flows - Get all flows (user's own or global)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // "my" | "global"
    const isActive = searchParams.get("isActive");

    // Build where clause
    const where: {
      tenantId: string;
      ownerId?: string | null;
      isGlobal?: boolean;
      isActive?: boolean;
    } = {
      tenantId: user.tenantId,
    };

    if (type === "my") {
      where.ownerId = session.user.id;
      where.isGlobal = false;
    } else if (type === "global") {
      where.isGlobal = true;
      // Global flows can have owner or be system-wide (ownerId = null)
      // This query returns all global flows in the tenant
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const flows = await prisma.flow.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
        assignments: {
          include: {
            page: {
              select: {
                id: true,
                name: true,
                facebookId: true,
              },
            },
          },
        },
        _count: {
          select: {
            leads: true,
            sessions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ flows });
  } catch (error) {
    console.error("[Flows API] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flows" },
      { status: 500 },
    );
  }
}

// POST /api/flows - Create a new flow
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check plan limits
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 403 },
      );
    }

    // Count user's existing flows
    const existingFlowCount = await prisma.flow.count({
      where: {
        tenantId: user.tenantId,
        ownerId: session.user.id,
        isGlobal: false,
      },
    });

    const maxFlows = subscription.plan.maxFlows || 3;
    if (existingFlowCount >= maxFlows) {
      return NextResponse.json(
        {
          error: `Flow limit reached. Your plan allows maximum ${maxFlows} flows.`,
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      nodes = [],
      language = "en",
      fallbackMessage,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Flow name is required" },
        { status: 400 },
      );
    }

    // Create flow with nodes
    const flow = await prisma.flow.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        tenantId: user.tenantId,
        ownerId: session.user.id,
        isGlobal: false,
        language,
        fallbackMessage: fallbackMessage || "Sorry, I didn't understand that.",
        nodes: {
          create: nodes.map(
            (
              node: { type: string; content?: Record<string, unknown> },
              index: number,
            ) => ({
              type: node.type,
              content: node.content
                ? JSON.parse(JSON.stringify(node.content))
                : {},
              order: index,
            }),
          ),
        },
      },
      include: {
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    console.error("[Flows API] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create flow" },
      { status: 500 },
    );
  }
}
