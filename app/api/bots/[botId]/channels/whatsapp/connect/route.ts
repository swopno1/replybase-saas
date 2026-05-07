import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import { getTenantLimits } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

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

    const body = await req.json();
    const { provider, name, ...credentials } = body;

    const limits = await getTenantLimits(user.tenantId);
    const currentChannels = await prisma.channel.count({
      where: { botId, type: "whatsapp", isActive: true },
    });

    if (currentChannels >= limits.maxChannelsPerBot) {
      return NextResponse.json(
        { error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot)` },
        { status: 403 },
      );
    }

    const encryptedToken = encryptWhatsAppCredentialEnvelope({
      provider,
      credentials,
    });

    const channelId = provider === "meta_cloud" ? credentials.metaPhoneNumberId : credentials.twilioFromNumber;

    const channel = await prisma.channel.create({
      data: {
        tenantId: user.tenantId,
        botId,
        type: "whatsapp",
        name: name || "WhatsApp",
        channelId: String(channelId),
        accessToken: encryptedToken,
        config: {
          provider,
          ...credentials,
        },
      },
    });

    return NextResponse.json({ success: true, channelId: channel.id });
  } catch (error) {
    console.error("[WhatsApp Connect] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
