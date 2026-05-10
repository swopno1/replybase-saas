import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { deleteTelegramWebhook } from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

const disconnectSchema = z.object({
  channelId: z.string().min(1),
  dropPendingUpdates: z.boolean().optional(),
});

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const body = await req.json();
    const validated = disconnectSchema.parse(body);

    const channel = await db.channel.findFirst({
      where: {
        id: validated.channelId,
        botId,
        type: "telegram",
        bot: {
          tenantId: tenantId,
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Telegram channel not found" },
        { status: 404 },
      );
    }

    if (channel.accessToken) {
      try {
        const token = decryptTelegramToken(channel.accessToken);
        await deleteTelegramWebhook(
          token,
          Boolean(validated.dropPendingUpdates),
        );
      } catch (error) {
        console.warn("[Telegram Disconnect] Failed to delete webhook:", error);
      }
    }

    const currentConfig = (channel.config as Prisma.JsonObject | null) || {};

    await db.channel.update({
      where: { id: channel.id },
      data: {
        isActive: false,
        enabled: false,
        killSwitch: true,
        config: {
          ...currentConfig,
          webhookConnected: false,
          webhookSecret: null,
          lastWebhookError: null,
          lastWebhookErrorAt: null,
          disconnectedAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    console.error("[Telegram Disconnect] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect Telegram" },
      { status: 500 },
    );
  }
});
