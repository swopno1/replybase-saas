import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const POST = withAuthAndTenant(async (user, request, context, db) => {
  try {
    const params = await context.params;
    const id = params.id as string;

    // Use global prisma — admins may clone flows from any tenant or global flows
    const sourceFlow = await prisma.flow.findUnique({
      where: { id },
      include: {
        nodes: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceFlow) {
      return NextResponse.json(
        { error: "Source flow not found" },
        { status: 404 },
      );
    }

    const canClone =
      (sourceFlow.ownerId === user.id &&
        sourceFlow.tenantId === user.tenantId) ||
      user.isAdmin;

    if (!canClone) {
      return NextResponse.json(
        { error: "You don't have permission to clone this flow" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const cloneName = body.name || `Copy of ${sourceFlow.name}`;

    const clonedFlow = await db.flow.create({
      data: {
        name: cloneName,
        description: sourceFlow.description,
        tenantId: user.tenantId,
        ownerId: user.id,
        isGlobal: false,
        isActive: false,
        version: 1,
        language: sourceFlow.language,
        fallbackMessage: sourceFlow.fallbackMessage,
        maxTimeout: sourceFlow.maxTimeout,
        nodes: {
          create: sourceFlow.nodes.map(
            (node) =>
              ({
                type: node.type,
                content: node.content as Prisma.InputJsonValue,
                order: node.order,
              }) as Prisma.FlowNodeCreateWithoutFlowInput,
          ),
        },
      },
      include: {
        nodes: {
          orderBy: { order: "asc" },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      flow: clonedFlow,
      message: `Flow cloned successfully. You can now customize it.`,
    });
  } catch (error) {
    console.error("[Flows] Error cloning flow:", error);
    return NextResponse.json(
      { error: "Failed to clone flow" },
      { status: 500 },
    );
  }
});
