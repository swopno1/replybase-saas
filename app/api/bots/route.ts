import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkBotLimit } from "@/lib/subscription";
import { z } from "zod";

const createBotSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["web", "facebook", "telegram", "whatsapp"]).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bots = await prisma.bot.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        channels: {
          select: {
            id: true,
            type: true,
            name: true,
            enabled: true,
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const mappedBots = bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      status: bot.enabled,
      createdAt: bot.createdAt,
      primaryChannel: bot.channels[0]?.type || "web",
      channels: bot.channels,
    }));

    // Mock project structure to satisfy frontend expected interface
    const projects = [
      {
        id: "default",
        name: "My Bots",
        bots: mappedBots,
      },
    ];

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch bots" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Check Limits
  const limitStatus = await checkBotLimit(session.user.tenantId);
  if (!limitStatus.allowed) {
    return NextResponse.json(
      {
        error: "Plan limit reached",
        details: `You have reached the maximum of ${limitStatus.limit} bots on the ${limitStatus.planName} plan. Please upgrade.`,
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const parsed = createBotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { name, channel } = parsed.data;
    const normalizedChannelType = channel || "web";

    const bot = await prisma.bot.create({
      data: {
        name,
        // projectId, // Remove projectId assignment
        tenantId: session.user.tenantId,
        enabled: true,
        channels: {
          create: {
            type: normalizedChannelType,
            name: "Default Channel",
            channelId: normalizedChannelType === "web" ? null : "default",
            enabled: true,
          },
        },
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("Bot creation error", error);
    return NextResponse.json(
      { error: "Failed to create bot" },
      { status: 500 },
    );
  }
}
