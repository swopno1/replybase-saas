import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/flows/:id/duplicate - Duplicate a flow
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

    const { id } = await context.params;

    // Get the flow to duplicate
    const sourceFlow = await prisma.flow.findFirst({
      where: {
        id,
        OR: [{ tenantId: user.tenantId }, { isGlobal: true }],
      },
      include: {
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!sourceFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
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

    // Create duplicate flow
    const duplicatedFlow = await prisma.flow.create({
      data: {
        name: `${sourceFlow.name} (Copy)`,
        description: sourceFlow.description,
        tenantId: user.tenantId,
        ownerId: session.user.id,
        isGlobal: false,
        isActive: false, // Start as inactive
        language: sourceFlow.language,
        fallbackMessage: sourceFlow.fallbackMessage,
        maxTimeout: sourceFlow.maxTimeout,
        nodes: {
          create: sourceFlow.nodes.map((node) => {
            return {
              type: node.type,
              content: JSON.parse(JSON.stringify(node.content)),
              order: node.order,
            };
          }),
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

    return NextResponse.json({ flow: duplicatedFlow }, { status: 201 });
  } catch (error) {
    console.error("[Flows API] Duplicate Error:", error);
    return NextResponse.json(
      { error: "Failed to duplicate flow" },
      { status: 500 },
    );
  }
}
