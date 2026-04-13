import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/flows/[id]/clone
 * Clone an existing flow
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 },
      );
    }

    // Fetch the source flow
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

    // Check if user has access to clone this flow
    // - Owner of the flow can clone it
    // - Admins can clone any flow
    const canClone =
      (sourceFlow.ownerId === session.user.id &&
        sourceFlow.tenantId === user.tenantId) ||
      isPlatformAdmin(session);

    if (!canClone) {
      return NextResponse.json(
        { error: "You don't have permission to clone this flow" },
        { status: 403 },
      );
    }

    // Get clone name from body (default: "Copy of ...")
    const body = await req.json();
    const cloneName = body.name || `Copy of ${sourceFlow.name}`;

    // Clone the flow and its nodes
    const clonedFlow = await prisma.flow.create({
      data: {
        name: cloneName,
        description: sourceFlow.description,
        tenantId: user.tenantId,
        ownerId: session.user.id,
        isGlobal: false, // Cloned flows are always private to tenant
        isActive: false, // Start inactive
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
}
