import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async (user, request, context, db) => {
  try {
    const params = await context.params;
    const id = params.id as string;
    const body = await request.json();
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

    const flow = await db.flow.findFirst({ where: { id } });
    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    if (pageId) {
      const page = await db.facebookPage.findFirst({ where: { id: pageId } });
      if (!page) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      await db.flowAssignment.updateMany({
        where: { pageId, isActive: true },
        data: { isActive: false },
      });

      const assignment = await db.flowAssignment.upsert({
        where: { pageId },
        update: { flowId: id, isActive: true },
        create: { flowId: id, pageId, isActive: true },
        include: {
          flow: { select: { id: true, name: true, isActive: true } },
          page: { select: { id: true, name: true, facebookId: true } },
        },
      });

      return NextResponse.json({ assignment, targetType: "page" });
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId },
      select: { id: true, name: true, type: true },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await db.flowChannelAssignment.updateMany({
      where: { channelId: channel.id, isActive: true },
      data: { isActive: false },
    });

    const assignment = await db.flowChannelAssignment.upsert({
      where: { channelId: channel.id },
      update: { flowId: id, isActive: true },
      create: { flowId: id, channelId: channel.id, isActive: true },
      include: {
        flow: { select: { id: true, name: true, isActive: true } },
        channel: { select: { id: true, name: true, type: true } },
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
});

export const DELETE = withAuthAndTenant(async (user, request, context, db) => {
  try {
    const params = await context.params;
    const id = params.id as string;
    const searchParams = request.nextUrl.searchParams;
    const pageId = searchParams.get("pageId");
    const channelId = searchParams.get("channelId");

    const targetCount = Number(Boolean(pageId)) + Number(Boolean(channelId));
    if (targetCount !== 1) {
      return NextResponse.json(
        { error: "Provide exactly one target: pageId or channelId" },
        { status: 400 },
      );
    }

    const flow = await db.flow.findFirst({ where: { id } });
    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    if (pageId) {
      await db.flowAssignment.updateMany({
        where: { flowId: id, pageId },
        data: { isActive: false },
      });

      return NextResponse.json({ success: true, targetType: "page" });
    }

    const channel = await db.channel.findFirst({
      where: { id: channelId! },
      select: { id: true },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    await db.flowChannelAssignment.updateMany({
      where: { flowId: id, channelId: channel.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, targetType: "channel" });
  } catch (error) {
    console.error("[Flows API] Unassign Error:", error);
    return NextResponse.json(
      { error: "Failed to unassign flow" },
      { status: 500 },
    );
  }
});
