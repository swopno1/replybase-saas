import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/flows/:id - Get a specific flow
export async function GET(
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
      select: { tenantId: true, isAdmin: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id } = await context.params;

    const flow = await prisma.flow.findFirst({
      where: {
        id,
        OR: [{ tenantId: user.tenantId }, { isGlobal: true }],
      },
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
    });

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const channelAssignments = await prisma.flowChannelAssignment.findMany({
      where: {
        flowId: flow.id,
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
            bot: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      flow: {
        ...flow,
        channelAssignments,
      },
    });
  } catch (error) {
    console.error("[Flows API] GET by ID Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flow" },
      { status: 500 },
    );
  }
}

// PUT /api/flows/:id - Update a flow
export async function PUT(
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
      select: { tenantId: true, isAdmin: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id } = await context.params;

    // Check if flow exists and user has permission
    const existingFlow = await prisma.flow.findFirst({
      where: {
        id,
        OR: [{ tenantId: user.tenantId }, { isGlobal: true }],
      },
    });

    if (!existingFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Global templates are read-only in regular flow editing.
    if (existingFlow.isGlobal) {
      return NextResponse.json(
        { error: "Cannot edit global flows. Please duplicate it first." },
        { status: 403 },
      );
    }

    if (existingFlow.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to edit this flow" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      nodes,
      isActive,
      language,
      fallbackMessage,
      maxTimeout,
    } = body;

    // Update flow
    const updatedFlow = await prisma.$transaction(async (tx) => {
      // If nodes are provided, delete existing nodes and create new ones
      if (nodes !== undefined) {
        await tx.flowNode.deleteMany({
          where: { flowId: id },
        });

        await tx.flowNode.createMany({
          data: nodes.map(
            (
              node: { type: string; content?: Record<string, unknown> },
              index: number,
            ) => ({
              flowId: id,
              type: node.type,
              content: node.content
                ? JSON.parse(JSON.stringify(node.content))
                : {},
              order: index,
            }),
          ),
        });
      }

      // Update flow
      return await tx.flow.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && {
            description: description?.trim() || null,
          }),
          ...(isActive !== undefined && { isActive }),
          ...(language !== undefined && { language }),
          ...(fallbackMessage !== undefined && { fallbackMessage }),
          ...(maxTimeout !== undefined && { maxTimeout }),
          version: {
            increment: 1,
          },
        },
        include: {
          nodes: {
            orderBy: {
              order: "asc",
            },
          },
          assignments: {
            include: {
              page: true,
            },
          },
        },
      });
    });

    const channelAssignments = await prisma.flowChannelAssignment.findMany({
      where: {
        flowId: updatedFlow.id,
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
            bot: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      flow: {
        ...updatedFlow,
        channelAssignments,
      },
    });
  } catch (error) {
    console.error("[Flows API] PUT Error:", error);
    return NextResponse.json(
      { error: "Failed to update flow" },
      { status: 500 },
    );
  }
}

// DELETE /api/flows/:id - Delete a flow
export async function DELETE(
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
      select: { tenantId: true, isAdmin: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id } = await context.params;

    // Check if flow exists and user has permission
    const existingFlow = await prisma.flow.findFirst({
      where: {
        id,
        OR: [{ tenantId: user.tenantId }, { isGlobal: true }],
      },
    });

    if (!existingFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Check if user owns the flow
    if (existingFlow.isGlobal && !user.isAdmin) {
      return NextResponse.json(
        { error: "Only admin users can delete global flows" },
        { status: 403 },
      );
    }

    if (existingFlow.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this flow" },
        { status: 403 },
      );
    }

    // Delete flow (cascade delete will handle nodes, assignments, sessions)
    await prisma.flow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Flows API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to delete flow" },
      { status: 500 },
    );
  }
}
