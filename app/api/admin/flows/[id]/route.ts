import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    const flow = await db.flow.findUnique({
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

    const channelAssignments = await db.flowChannelAssignment.findMany({
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
});

export const PUT = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    // Check if flow exists
    const existingFlow = await db.flow.findUnique({
      where: { id },
    });

    if (!existingFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    const body = await request.json();
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
    const updatedFlow = await db.$transaction(async (tx) => {
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
});

export const DELETE = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    // Check if flow exists
    const existingFlow = await db.flow.findUnique({
      where: { id },
    });

    if (!existingFlow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Delete flow (Prisma will handle cascading deletes if configured in schema)
    await db.flow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Flow deleted successfully" });
  } catch (error) {
    console.error("[Admin Flows API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to delete flow" },
      { status: 500 },
    );
  }
});
