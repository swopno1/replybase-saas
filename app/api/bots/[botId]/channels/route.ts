import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getUserLimits } from "@/lib/subscription";
import { authOptions } from "@/lib/auth";
import { JsonObject } from "@prisma/client/runtime/library";

const createChannelSchema = z.object({
  type: z.enum(["facebook", "whatsapp", "web"]),
  name: z.string().min(1),
  channelId: z.string().min(1),
  accessToken: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// GET: List channels for a bot
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("[Channels API] Error fetching channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

// POST: Create a new channel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
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
    const limits = await getUserLimits(session.user.id);
    const channelCount = await prisma.channel.count({
      where: { botId },
    });

    if (channelCount >= limits.maxChannelsPerBot) {
      return NextResponse.json(
        {
          error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot)`,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createChannelSchema.parse(body);

    const channel = await prisma.channel.create({
      data: {
        botId,
        type: validated.type,
        name: validated.name,
        channelId: validated.channelId,
        accessToken: validated.accessToken || null,
        config: (validated.config || {}) as JsonObject,
        enabled: true,
        killSwitch: false,
      },
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("[Channels API] Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
