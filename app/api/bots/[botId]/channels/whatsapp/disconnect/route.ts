import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const disconnectSchema = z.object({
  channelId: z.string().min(1),
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
        type: "whatsapp",
        bot: { tenantId: tenantId },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "WhatsApp channel not found" },
        { status: 404 },
      );
    }

    const currentConfig = (channel.config as Prisma.JsonObject | null) || {};

    await db.channel.update({
      where: { id: channel.id },
      data: {
        isActive: false,
        enabled: false,
        killSwitch: true,
        accessToken: null,
        config: {
          ...currentConfig,
          disconnectedAt: new Date().toISOString(),
          webhookConnected: false,
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

    console.error("[WhatsApp Disconnect] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect WhatsApp integration",
      },
      { status: 500 },
    );
  }
});
