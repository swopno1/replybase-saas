import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const disconnectSchema = z.object({
  channelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
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
        type: "whatsapp",
        bot: { tenantId: user.tenantId },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "WhatsApp channel not found" },
        { status: 404 },
      );
    }

    const currentConfig = (channel.config as Prisma.JsonObject | null) || {};

    await prisma.channel.update({
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
}
