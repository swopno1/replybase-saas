import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, _req, context, db) => {
  const { botId, channelId } = (await context.params) as { botId: string; channelId: string };

  const channel = await db.channel.findFirst({
    where: {
      id: channelId,
      bot: {
        id: botId,
        tenantId: tenantId,
      },
    },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({ channel });
});

export const PATCH = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  const { botId, channelId } = (await context.params) as { botId: string; channelId: string };

  const existingChannel = await db.channel.findFirst({
    where: {
      id: channelId,
      bot: {
        id: botId,
        tenantId: tenantId,
      },
    },
  });

  if (!existingChannel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, config } = body;

  const channel = await db.channel.update({
    where: { id: channelId },
    data: {
      ...(name && { name }),
      ...(config && { config }),
    },
  });

  return NextResponse.json({ channel });
});

export const DELETE = withAuthAndTenant(async ({ tenantId }, _req, context, db) => {
  const { botId, channelId } = (await context.params) as { botId: string; channelId: string };

  const channel = await db.channel.findFirst({
    where: {
      id: channelId,
      bot: {
        id: botId,
        tenantId: tenantId,
      },
    },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  await db.channel.delete({
    where: { id: channelId },
  });

  return NextResponse.json({ success: true });
});
