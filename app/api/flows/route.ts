import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

// GET /api/flows - Get all flows (user's own or global)
export const GET = withAuthAndTenant(
  async ({ tenantId }, req, _context, db) => {
    try {
      const searchParams = req.nextUrl.searchParams;
      const type = searchParams.get("type"); // "my" | "global"
      const isActive = searchParams.get("isActive");

      const where: Prisma.FlowWhereInput = {};

      if (type === "my") {
        where.tenantId = tenantId;
        where.isGlobal = false;
      } else if (type === "global") {
        where.isGlobal = true;
      } else {
        where.OR = [{ tenantId: tenantId }, { isGlobal: true }];
      }

      if (isActive !== null && isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      // If we are listing global templates or a mixed list, we must use the global prisma
      // to allow global flows created by other tenants (e.g. system admin tenant).
      const prismaClient: any = (type === "my") ? db : prisma;

      const flows = await prismaClient.flow.findMany({
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
);

// POST /api/flows - Create a new flow
export const POST = withAuthAndTenant(
  async ({ tenantId, id: userId }, req, _context, db) => {
    try {
      // Check plan limits
      const subscription = await db.subscription.findUnique({
        where: { tenantId },
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
      const existingFlowCount = await db.flow.count({
        where: {
          tenantId,
          ownerId: userId,
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
        isGlobal = false,
      } = body;

      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: "Flow name is required" },
          { status: 400 },
        );
      }

      // Check admin status for global templates creation
      const userRecord = await db.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      let canCreateGlobal = Boolean(userRecord?.isAdmin);
      if (isGlobal && !canCreateGlobal) {
        const adminCount = await db.user.count({
          where: {
            isAdmin: true,
          },
        });

        if (adminCount === 0) {
          await db.user.update({
            where: {
              id: userId,
            },
            data: {
              isAdmin: true,
            },
          });
          canCreateGlobal = true;
        }
      }

      if (isGlobal && !canCreateGlobal) {
        return NextResponse.json(
          { error: "Only admin users can create global template flows" },
          { status: 403 },
        );
      }

      // Create flow with nodes
      const flow = await db.flow.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          tenantId,
          ownerId: userId,
          isGlobal: Boolean(isGlobal),
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
);
