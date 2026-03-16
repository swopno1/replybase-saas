import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
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

  const bot = await prisma.bot.findFirst({
    where: {
      id: botId,
      tenantId: user.tenantId,
    },
    include: {
      channels: true,
    },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  return NextResponse.json({ bot });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
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

  const existingBot = await prisma.bot.findFirst({
    where: {
      id: botId,
      tenantId: user.tenantId,
    },
  });

  if (!existingBot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, enabled } = body;

  const bot = await prisma.bot.update({
    where: { id: botId },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    },
  });

  return NextResponse.json({ bot });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
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

  const bot = await prisma.bot.findFirst({
    where: {
      id: botId,
      tenantId: user.tenantId,
    },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  await prisma.bot.delete({
    where: { id: botId },
  });

  return NextResponse.json({ success: true });
}
