import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

// GET /api/flows/:id - Get a specific flow
export const GET = withAuthAndTenant(
  async ({ tenantId, id: userId }, req, context, db) => {
    try {
      const { id } = await context.params;
      const flowId = id as string;

      // Use global prisma for GET to allow isGlobal flows which might have different tenantId (null)
      const flow = await prisma.flow.findFirst({
        where: {
          id: flowId,
          OR: [{ tenantId }, { isGlobal: true }],
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
      console.error("[Flows API] GET by ID Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch flow" },
        { status: 500 },
      );
    }
  }
);

// PUT /api/flows/:id - Update a flow
export const PUT = withAuthAndTenant(
  async ({ tenantId, id: userId }, req, context, db) => {
    try {
      const { id } = await context.params;
      const flowId = id as string;

      // Check if flow exists and user has permission
      const existingFlow = await db.flow.findFirst({
        where: {
          id: flowId,
          tenantId
        },
      });

      if (!existingFlow) {
        // Might be global
        const globalFlow = await prisma.flow.findFirst({ where: { id: flowId, isGlobal: true } });
        if (globalFlow) {
           return NextResponse.json(
            { error: "Cannot edit global flows. Please duplicate it first." },
            { status: 403 },
          );
        }
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
      }

      if (existingFlow.ownerId !== userId) {
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
      const updatedFlow = await db.$transaction(async (tx) => {
        // If nodes are provided, delete existing nodes and create new ones
        if (nodes !== undefined) {
          await tx.flowNode.deleteMany({
            where: { flowId: flowId },
          });

          await tx.flowNode.createMany({
            data: nodes.map(
              (
                node: { type: string; content?: Record<string, unknown> },
                index: number,
              ) => ({
                flowId: flowId,
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
          where: { id: flowId, tenantId },
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

      const channelAssignments = await db.flowChannelAssignment.findMany({
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
);

// DELETE /api/flows/:id - Delete a flow
export const DELETE = withAuthAndTenant(
  async ({ tenantId, id: userId }, req, context, db) => {
    try {
      const { id } = await context.params;
      const flowId = id as string;

      const session = await getServerSession(authOptions);
      const isAdmin = session?.user?.isAdmin || false;

      // Check if flow exists and user has permission
      const existingFlow = await prisma.flow.findFirst({
        where: {
          id: flowId,
          OR: [{ tenantId }, { isGlobal: true }],
        },
      });

      if (!existingFlow) {
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
      }

      // Check if user owns the flow
      if (existingFlow.isGlobal && !isAdmin) {
        return NextResponse.json(
          { error: "Only admin users can delete global flows" },
          { status: 403 },
        );
      }

      if (!existingFlow.isGlobal && existingFlow.ownerId !== userId) {
        return NextResponse.json(
          { error: "You don't have permission to delete this flow" },
          { status: 403 },
        );
      }

      // Delete flow (cascade delete will handle nodes, assignments, sessions)
      // If it's a global flow, we might need global prisma if it doesn't have the current tenantId
      if (existingFlow.isGlobal) {
          await prisma.flow.delete({
            where: { id: flowId },
          });
      } else {
          await db.flow.delete({
            where: { id: flowId, tenantId },
          });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[Flows API] DELETE Error:", error);
      return NextResponse.json(
        { error: "Failed to delete flow" },
        { status: 500 },
      );
    }
  }
);
