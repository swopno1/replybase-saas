import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET /api/admin/flows/:id - Get any flow (Admin only)
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN" && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await context.params;

    const flow = await prisma.flow.findUnique({
      where: { id },
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
    console.error("[Admin Flows API] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flow" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/flows/:id - Update any flow (Admin only)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN" && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await context.params;

    // Check if flow exists
    const existingFlow = await prisma.flow.findUnique({
      where: { id },
    });

    if (!existingFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
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
        },
      });
    });

    return NextResponse.json({
      flow: updatedFlow,
    });
  } catch (error) {
    console.error("[Admin Flows API] PUT Error:", error);
    return NextResponse.json(
      { error: "Failed to update flow" },
      { status: 500 },
    );
  }
}
