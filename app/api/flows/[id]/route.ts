import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET /api/flows/:id - Get a specific flow
export const GET = withAuthAndTenant(
  async ({ tenantId, id: userId }, req, context, db) => {
    try {
      const { id } = await context.params;
      const flowId = id as string;

      const flow = await prisma.flow.findFirst({
        where: {
          id: flowId,
          OR: [{ tenantId }, { isGlobal: true }],
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          nodes: { orderBy: { order: "asc" } },
          assignments: { include: { page: { select: { id: true, name: true, facebookId: true } } } },
          _count: { select: { leads: true, sessions: true } },
        },
      });

      if (!flow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });

      const channelAssignments = await db.flowChannelAssignment.findMany({
        where: { flowId: flow.id },
        include: { channel: { select: { id: true, name: true, type: true, bot: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ flow: { ...flow, channelAssignments } });
    } catch (error) {
      console.error("[Flows API] GET by ID Error:", error);
      return NextResponse.json({ error: "Failed to fetch flow" }, { status: 500 });
    }
  }
);

// PUT /api/flows/:id - Update a flow
export const PUT = withAuthAndTenant(
  async ({ tenantId, id: userId, isAdmin }, req, context, db) => {
    try {
      const { id } = await context.params;
      const flowId = id as string;

      const existingFlow = await db.flow.findFirst({ where: { id: flowId, tenantId } });

      if (!existingFlow) {
        const globalFlow = await prisma.flow.findFirst({ where: { id: flowId, isGlobal: true } });
        if (globalFlow) return NextResponse.json({ error: "Cannot edit global flows." }, { status: 403 });
        return NextResponse.json({ error: "Flow not found" }, { status: 404 });
      }

      if (existingFlow.ownerId !== userId && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const body = await req.json();
      const { name, description, nodes, isActive, language, fallbackMessage, maxTimeout } = body;

      const updatedFlow = await db.$transaction(async (tx) => {
        if (nodes !== undefined) {
          await tx.flowNode.deleteMany({ where: { flowId } });
          await tx.flowNode.createMany({
            data: nodes.map((node: any, index: number) => ({
              flowId,
              type: node.type,
              content: node.content ? JSON.parse(JSON.stringify(node.content)) : {},
              order: index,
            })),
          });
        }

        return await tx.flow.update({
          where: { id: flowId, tenantId },
          data: {
            ...(name !== undefined && { name: name.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(isActive !== undefined && { isActive }),
            ...(language !== undefined && { language }),
            ...(fallbackMessage !== undefined && { fallbackMessage }),
            ...(maxTimeout !== undefined && { maxTimeout }),
            version: { increment: 1 },
          },
          include: { nodes: { orderBy: { order: "asc" } }, assignments: { include: { page: true } } },
        });
      });

      return NextResponse.json({ flow: updatedFlow });
    } catch (error) {
      console.error("[Flows API] PUT Error:", error);
      return NextResponse.json({ error: "Failed to update flow" }, { status: 500 });
    }
  }
);

// DELETE /api/flows/:id - Delete a flow
export const DELETE = withAuthAndTenant(
  async ({ tenantId, id: userId, isAdmin }, req, context, db) => {
    try {
      const { id } = await context.params;
      const flowId = id as string;

      const existingFlow = await prisma.flow.findFirst({ where: { id: flowId, OR: [{ tenantId }, { isGlobal: true }] } });
      if (!existingFlow) return NextResponse.json({ error: "Flow not found" }, { status: 404 });

      if (existingFlow.isGlobal && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!existingFlow.isGlobal && existingFlow.ownerId !== userId && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      if (existingFlow.isGlobal) {
          await prisma.flow.delete({ where: { id: flowId } });
      } else {
          await db.flow.delete({ where: { id: flowId, tenantId } });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[Flows API] DELETE Error:", error);
      return NextResponse.json({ error: "Failed to delete flow" }, { status: 500 });
    }
  }
);
