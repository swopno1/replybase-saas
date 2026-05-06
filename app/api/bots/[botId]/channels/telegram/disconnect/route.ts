import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteTelegramWebhook } from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";

export const dynamic = 'force-dynamic';

const disconnectSchema = z.object({
  channelId: z.string().min(1),
  dropPendingUpdates: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const { botId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = disconnectSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: validated.channelId,
        botId,
        type: "telegram",
        bot: {
          tenantId: user.tenantId,
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

    await prisma.channel.update({
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
      { error: "Failed to disconnect Telegram" },
      { status: 500 },
    );
  }
}
