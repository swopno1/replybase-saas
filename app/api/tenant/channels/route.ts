import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelConfig, getEnabledChannels } from "@/lib/channel-config";

/**
 * GET /api/tenant/channels
 * Get current channel settings for the authenticated tenant
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    // Get or create tenant channel status
    let channelStatus = await prisma.tenantChannelStatus.findUnique({
      where: { tenantId },
    });

    if (!channelStatus) {
      // Create default channel status for new tenants
      channelStatus = await prisma.tenantChannelStatus.create({
        data: {
          tenantId,
          facebook: false, // Facebook disabled by default
          telegram: true,
          webchat: true,
          whatsapp: false,
        },
      });
    }

    // Get system-level configuration
    const systemChannels = [
      getChannelConfig("facebook"),
      getChannelConfig("telegram"),
      getChannelConfig("webchat"),
      getChannelConfig("whatsapp"),
    ];

    // Return combined configuration
    return NextResponse.json({
      tenant: {
        facebook: channelStatus.facebook && systemChannels[0].enabled,
        telegram: channelStatus.telegram && systemChannels[1].enabled,
        webchat: channelStatus.webchat && systemChannels[2].enabled,
        whatsapp: channelStatus.whatsapp && systemChannels[3].enabled,
      },
      tenantOnly: {
        facebook: channelStatus.facebook,
        telegram: channelStatus.telegram,
        webchat: channelStatus.webchat,
        whatsapp: channelStatus.whatsapp,
      },
      systemLevel: {
        facebook: systemChannels[0].enabled,
        telegram: systemChannels[1].enabled,
        webchat: systemChannels[2].enabled,
        whatsapp: systemChannels[3].enabled,
      },
      channelConfigs: systemChannels,
    });
  } catch (error) {
    console.error("[Tenant Channels API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel settings" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/tenant/channels
 * Update channel settings for the authenticated tenant
 * (only applies if system-level channel is enabled)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await req.json();

    // Get or create tenant channel status
    let channelStatus = await prisma.tenantChannelStatus.findUnique({
      where: { tenantId },
    });

    if (!channelStatus) {
      channelStatus = await prisma.tenantChannelStatus.create({
        data: {
          tenantId,
          facebook: false,
          telegram: true,
          webchat: true,
          whatsapp: false,
        },
      });
    }

    // Only update fields that are provided and allowed
    const updateData: Record<string, boolean> = {};

    // Facebook: can disable at tenant level only if system level is enabled
    if (body.facebook !== undefined && getChannelConfig("facebook").enabled) {
      updateData.facebook = body.facebook;
    }

    // Telegram
    if (body.telegram !== undefined && getChannelConfig("telegram").enabled) {
      updateData.telegram = body.telegram;
    }

    // WebChat
    if (body.webchat !== undefined && getChannelConfig("webchat").enabled) {
      updateData.webchat = body.webchat;
    }

    // WhatsApp
    if (body.whatsapp !== undefined && getChannelConfig("whatsapp").enabled) {
      updateData.whatsapp = body.whatsapp;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid channel updates provided or channels disabled at system level",
        },
        { status: 400 },
      );
    }

    channelStatus = await prisma.tenantChannelStatus.update({
      where: { tenantId },
      data: updateData,
    });

    // Get system-level configuration
    const systemChannels = [
      getChannelConfig("facebook"),
      getChannelConfig("telegram"),
      getChannelConfig("webchat"),
      getChannelConfig("whatsapp"),
    ];

    return NextResponse.json({
      tenant: {
        facebook: channelStatus.facebook && systemChannels[0].enabled,
        telegram: channelStatus.telegram && systemChannels[1].enabled,
        webchat: channelStatus.webchat && systemChannels[2].enabled,
        whatsapp: channelStatus.whatsapp && systemChannels[3].enabled,
      },
      tenantOnly: {
        facebook: channelStatus.facebook,
        telegram: channelStatus.telegram,
        webchat: channelStatus.webchat,
        whatsapp: channelStatus.whatsapp,
      },
      systemLevel: {
        facebook: systemChannels[0].enabled,
        telegram: systemChannels[1].enabled,
        webchat: systemChannels[2].enabled,
        whatsapp: systemChannels[3].enabled,
      },
      message: "Channel settings updated successfully",
    });
  } catch (error) {
    console.error("[Tenant Channels API] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update channel settings" },
      { status: 500 },
    );
  }
}
