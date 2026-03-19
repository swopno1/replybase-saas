import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getTenantLimits } from "@/lib/subscription";
import { authOptions } from "@/lib/auth";

const createChannelSchema = z
  .object({
    type: z.enum(["facebook", "whatsapp", "web", "telegram"]),
    name: z.string().min(1),
    channelId: z.string().min(1).optional(),
    accessToken: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "web" && !data.channelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "channelId is required for non-web channels",
        path: ["channelId"],
      });
    }
  });

// GET: List channels for a bot
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    // Verify ownership via tenant
    const bot = await prisma.bot.findFirst({
      where: { id: botId, tenantId: user.tenantId },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const channels = await prisma.channel.findMany({
      where: { botId },
      include: {
        flowAssignments: {
          where: { isActive: true },
          include: {
            flow: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("[Channels API] Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 },
    );
  }
}

// POST: Create a new channel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    // Verify ownership via tenant
    const bot = await prisma.bot.findFirst({
      where: { id: botId, tenantId: user.tenantId },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // Check channel limit
    const limits = await getTenantLimits(user.tenantId);
    const channelCount = await prisma.channel.count({
      where: { botId },
    });

    if (channelCount >= limits.maxChannelsPerBot) {
      return NextResponse.json(
        {
          error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot)`,
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validated = createChannelSchema.parse(body);
    const normalizedType = validated.type;

    const channel = await prisma.channel.create({
      data: {
        botId,
        type: normalizedType,
        name: validated.name,
        channelId: validated.channelId || null,
        accessToken: validated.accessToken || null,
        config: (validated.config || {}) as Prisma.JsonObject,
        enabled: true,
        killSwitch: false,
      },
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    console.error("[Channels API] Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 },
    );
  }
}
