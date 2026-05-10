import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { checkBotLimit } from "@/lib/subscription";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const createBotSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["web", "facebook", "telegram", "whatsapp"]).optional(),
  context: z.string().optional(),
  entryFlow: z.string().optional(),
});

export const GET = withAuthAndTenant(async ({ tenantId }, _req, _context, db) => {
  try {
    const [bots, limitStatus] = await Promise.all([
      db.bot.findMany({
        where: { tenantId: tenantId },
        orderBy: { createdAt: "desc" },
        include: {
          channels: {
            select: { id: true, type: true, name: true, enabled: true, isActive: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      checkBotLimit(tenantId),
    ]);

    const mappedBots = bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      status: bot.enabled,
      createdAt: bot.createdAt,
      primaryChannel: bot.channels[0]?.type || "web",
      channels: bot.channels,
    }));

    return NextResponse.json({
      bots: mappedBots,
      limitStatus
    });
  } catch (error) {
    console.error("Failed to fetch bots:", error);
    return NextResponse.json({ error: "Failed to fetch bots" }, { status: 500 });
  }
});

export const POST = withAuthAndTenant(async ({ tenantId, id: userId }, req, _context, db) => {
  const limitStatus = await checkBotLimit(tenantId);
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
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const { name, channel, context } = parsed.data;
    const normalizedChannelType = channel || "web";
    let parsedContext: any = {};
    if (context && context.trim()) {
      try {
        parsedContext = JSON.parse(context);
      } catch {
        parsedContext = context;
      }
    }
    const bot = await db.bot.create({
      data: {
        name,
        tenantId: tenantId,
        enabled: true,
        context: parsedContext,
        entryFlow: parsed.data.entryFlow,
        channels: {
          create: {
            tenantId: tenantId,
            type: normalizedChannelType,
            name: "Default Channel",
            channelId: normalizedChannelType === "web" ? null : `default-${Date.now()}`,
            enabled: true,
          },
        },
      },
    });

    await recordActivity({
      tenantId: tenantId,
      userId: userId,
      type: "bot_created",
      title: "Bot Created",
      description: `Created bot ${bot.name}`,
      entityType: "bot",
      entityId: bot.id,
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("Bot creation error", error);
    return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
  }
});
