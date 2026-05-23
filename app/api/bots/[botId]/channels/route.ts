import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { checkChannelLimitWithType } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

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

export const GET = withAuthAndTenant(async ({ tenantId }, _req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };

    const bot = await db.bot.findFirst({
      where: { id: botId, tenantId: tenantId },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const [channels, tenant] = await Promise.all([
      db.channel.findMany({
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
      db.tenant.findUnique({
        where: { id: tenantId },
        include: { subscriptions: { include: { plan: true } } }
      })
    ]);

    return NextResponse.json({
      channels,
      plan: (tenant as any)?.subscriptions?.[0]?.plan || null
    });
  } catch (error) {
    console.error("[Channels API] Error fetching channels:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
});

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };

    const bot = await db.bot.findFirst({
      where: { id: botId, tenantId: tenantId },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = createChannelSchema.parse(body);

    const limitStatus = await checkChannelLimitWithType(tenantId, botId, validated.type);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        {
          error: limitStatus.error,
          details: limitStatus.message,
        },
        { status: 403 },
      );
    }

    const channel = await db.channel.create({
      data: {
        tenantId: tenantId,
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
});
