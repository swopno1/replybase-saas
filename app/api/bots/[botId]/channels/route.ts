import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getTenantLimits, checkChannelLimit } from "@/lib/subscription";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

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

    const [channels, limitStatus] = await Promise.all([
      prisma.channel.findMany({
        where: { botId },
        include: {
          flowAssignments: {
            where: { isActive: true },
            include: {
              flow: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      checkChannelLimit(user.tenantId, botId),
    ]);

    return NextResponse.json({ channels, limitStatus });
  } catch (error) {
    console.error("[Channels API] Error fetching channels:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}

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

    const limitStatus = await checkChannelLimit(user.tenantId, botId);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        {
          error: "Channel limit reached",
          details: `You have reached the maximum of ${limitStatus.limit} channels per bot on the ${limitStatus.planName} plan. Please upgrade.`,
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validated = createChannelSchema.parse(body);

    const channel = await prisma.channel.create({
      data: {
        tenantId: user.tenantId,
        botId,
        type: validated.type,
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
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    console.error("[Channels API] Error creating channel:", error);
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
  }
}
