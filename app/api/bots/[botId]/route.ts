import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkBotLimit } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

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
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const [bot, limitStatus] = await Promise.all([
    prisma.bot.findFirst({
      where: { id: botId, tenantId: user.tenantId },
      include: { channels: true },
    }),
    checkBotLimit(user.tenantId),
  ]);

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  return NextResponse.json({ bot, limitStatus });
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
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const existingBot = await prisma.bot.findFirst({
    where: { id: botId, tenantId: user.tenantId },
  });

  if (!existingBot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, enabled, entryFlowId } = body;

  const bot = await prisma.bot.update({
    where: { id: botId },
    data: {
      ...(name && { name }),
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      ...(entryFlowId !== undefined && { entryFlow: entryFlowId || null }),
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
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "No tenant found" }, { status: 403 });
  }

  const bot = await prisma.bot.findFirst({
    where: { id: botId, tenantId: user.tenantId },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Note: FacebookPage requires botId (String, not String?), so we delete them.
    await tx.facebookPage.deleteMany({ where: { botId } });
    await tx.crmConversation.updateMany({ where: { botId }, data: { botId: null } });
    await tx.executionLog.deleteMany({ where: { botId } });
    await tx.webChatSite.deleteMany({ where: { botId } });
    await tx.channel.deleteMany({ where: { botId } });
    await tx.bot.delete({ where: { id: botId } });
  });

  return NextResponse.json({ success: true });
}
