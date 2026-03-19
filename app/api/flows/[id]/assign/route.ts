import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/flows/:id/assign - Assign a flow to a page or channel
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
    const body = await req.json();
    const { pageId, channelId } = body as {
      pageId?: string;
      channelId?: string;
    };

    const targetCount = Number(Boolean(pageId)) + Number(Boolean(channelId));
    if (targetCount !== 1) {
      return NextResponse.json(
        { error: "Provide exactly one target: pageId or channelId" },
        { status: 400 },
      );
    }

    if (!pageId && !channelId) {
      return NextResponse.json(
        { error: "pageId or channelId is required" },
        { status: 400 },
      );
    }

    // Verify flow exists and belongs to tenant
    const flow = await prisma.flow.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    if (pageId) {
      const page = await prisma.facebookPage.findFirst({
        where: {
          id: pageId,
          tenantId: user.tenantId,
        },
      });

      if (!page) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      await prisma.flowAssignment.updateMany({
        where: {
          pageId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      const assignment = await prisma.flowAssignment.upsert({
        where: {
          pageId,
        },
        update: {
          flowId: id,
          isActive: true,
        },
        create: {
          flowId: id,
          pageId,
          isActive: true,
        },
        include: {
          flow: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          page: {
            select: {
              id: true,
              name: true,
              facebookId: true,
            },
          },
        },
      });

      return NextResponse.json({ assignment, targetType: "page" });
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        bot: {
          tenantId: user.tenantId,
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await prisma.flowChannelAssignment.updateMany({
      where: {
        channelId: channel.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const assignment = await prisma.flowChannelAssignment.upsert({
      where: {
        channelId: channel.id,
      },
      update: {
        flowId: id,
        isActive: true,
      },
      create: {
        flowId: id,
        channelId: channel.id,
        isActive: true,
      },
      include: {
        flow: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({ assignment, targetType: "channel" });
  } catch (error) {
    console.error("[Flows API] Assign Error:", error);
    return NextResponse.json(
      { error: "Failed to assign flow" },
      { status: 500 },
    );
  }
}

// DELETE /api/flows/:id/assign - Unassign a flow from a page or channel
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
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id } = await context.params;
    const searchParams = req.nextUrl.searchParams;
    const pageId = searchParams.get("pageId");
    const channelId = searchParams.get("channelId");

    const targetCount = Number(Boolean(pageId)) + Number(Boolean(channelId));
    if (targetCount !== 1) {
      return NextResponse.json(
        { error: "Provide exactly one target: pageId or channelId" },
        { status: 400 },
      );
    }

    if (!pageId && !channelId) {
      return NextResponse.json(
        { error: "pageId or channelId is required" },
        { status: 400 },
      );
    }

    // Verify flow exists and belongs to tenant
    const flow = await prisma.flow.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    if (pageId) {
      await prisma.flowAssignment.updateMany({
        where: {
          flowId: id,
          pageId,
        },
        data: {
          isActive: false,
        },
      });

      return NextResponse.json({ success: true, targetType: "page" });
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId || "",
        bot: {
          tenantId: user.tenantId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await prisma.flowChannelAssignment.updateMany({
      where: {
        flowId: id,
        channelId: channel.id,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ success: true, targetType: "channel" });
  } catch (error) {
    console.error("[Flows API] Unassign Error:", error);
    return NextResponse.json(
      { error: "Failed to unassign flow" },
      { status: 500 },
    );
  }
}
