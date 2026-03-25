import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';




export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { botId, channelId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      bot: {
        id: botId,
        tenantId: user.tenantId,
      },
    },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({ channel });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { botId, channelId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const existingChannel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      bot: {
        id: botId,
        tenantId: user.tenantId,
      },
    },
  });

  if (!existingChannel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, config } = body;

  const channel = await prisma.channel.update({
    where: { id: channelId },
    data: {
      ...(name && { name }),
      ...(config && { config }),
    },
  });

  return NextResponse.json({ channel });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { botId, channelId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      bot: {
        id: botId,
        tenantId: user.tenantId,
      },
    },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  await prisma.channel.delete({
    where: { id: channelId },
  });

  return NextResponse.json({ success: true });
}
