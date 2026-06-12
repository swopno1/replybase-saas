import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async (user, _request, context, db) => {
  try {
    const params = await context.params;
    const id = params.id as string;

    // Use global prisma — OR clause includes isGlobal flows which the scoped client would exclude
    const sourceFlow = await prisma.flow.findFirst({
      where: {
        id,
        OR: [{ tenantId: user.tenantId }, { isGlobal: true }],
      },
      include: {
        nodes: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const subscription = await db.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 403 },
      );
    }

    const existingFlowCount = await db.flow.count({
      where: {
        ownerId: user.id,
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

    const duplicatedFlow = await db.flow.create({
      data: {
        name: `${sourceFlow.name} (Copy)`,
        description: sourceFlow.description,
        tenantId: user.tenantId,
        ownerId: user.id,
        isGlobal: false,
        isActive: false,
        language: sourceFlow.language,
        fallbackMessage: sourceFlow.fallbackMessage,
        maxTimeout: sourceFlow.maxTimeout,
        nodes: {
          create: sourceFlow.nodes.map((node) => ({
            type: node.type,
            content: JSON.parse(JSON.stringify(node.content)),
            order: node.order,
          })),
        },
      },
      include: {
        nodes: {
          orderBy: { order: "asc" },
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
});
