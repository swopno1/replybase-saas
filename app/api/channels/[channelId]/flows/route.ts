import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * POST /api/channels/[channelId]/flows
 * Assigns a flow to a channel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId } = await params;
    const body = await req.json();
    const { flowId } = body as { flowId: string };

    if (!flowId) {
      return NextResponse.json({ error: "flowId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify channel belongs to tenant
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        bot: {
          tenantId: user.tenantId,
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Verify flow belongs to tenant
    const flow = await prisma.flow.findFirst({
      where: {
        id: flowId,
        tenantId: user.tenantId,
      },
    });

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Deactivate previous assignments for this channel
    await prisma.flowChannelAssignment.updateMany({
      where: {
        channelId: channel.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Upsert the new assignment
    const assignment = await prisma.flowChannelAssignment.upsert({
      where: {
        channelId: channel.id,
      },
      update: {
        flowId: flow.id,
        isActive: true,
      },
      create: {
        channelId: channel.id,
        flowId: flow.id,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error("[Channels Flow API] Error assigning flow:", error);
    return NextResponse.json({ error: "Failed to assign flow" }, { status: 500 });
  }
}

/**
 * DELETE /api/channels/[channelId]/flows
 * Unassigns the flow from a channel.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify channel belongs to tenant
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        bot: {
          tenantId: user.tenantId,
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Deactivate all assignments for this channel
    await prisma.flowChannelAssignment.updateMany({
      where: {
        channelId: channel.id,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Channels Flow API] Error unassigning flow:", error);
    return NextResponse.json({ error: "Failed to unassign flow" }, { status: 500 });
  }
}
