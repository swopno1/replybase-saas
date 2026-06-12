import { NextResponse } from "next/server";
import { getChannelConfig } from "@/lib/channel-config";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async (user, _request, _context, db) => {
  try {
    let channelStatus = await db.tenantChannelStatus.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!channelStatus) {
      channelStatus = await db.tenantChannelStatus.create({
        data: {
          tenantId: user.tenantId,
          facebook: false,
          telegram: true,
          webchat: true,
          whatsapp: false,
        },
      });
    }

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
      channelConfigs: systemChannels,
    });
  } catch (error) {
    console.error("[Tenant Channels API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel settings" },
      { status: 500 },
    );
  }
});

export const PATCH = withAuthAndTenant(async (user, request, _context, db) => {
  try {
    const body = await request.json();

    let channelStatus = await db.tenantChannelStatus.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!channelStatus) {
      channelStatus = await db.tenantChannelStatus.create({
        data: {
          tenantId: user.tenantId,
          facebook: false,
          telegram: true,
          webchat: true,
          whatsapp: false,
        },
      });
    }

    const updateData: Record<string, boolean> = {};

    if (body.facebook !== undefined && getChannelConfig("facebook").enabled) {
      updateData.facebook = body.facebook;
    }
    if (body.telegram !== undefined && getChannelConfig("telegram").enabled) {
      updateData.telegram = body.telegram;
    }
    if (body.webchat !== undefined && getChannelConfig("webchat").enabled) {
      updateData.webchat = body.webchat;
    }
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

    channelStatus = await db.tenantChannelStatus.update({
      where: { tenantId: user.tenantId },
      data: updateData,
    });

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
});
