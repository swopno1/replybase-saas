import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  decryptWhatsAppCredentialEnvelope,
  getStringFromJsonConfig,
} from "@/lib/whatsapp-channel-credentials";
import { maskSecret } from "@/lib/whatsapp-provider";
import { checkChannelLimitWithType } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const channelId = req.nextUrl.searchParams.get("channelId");

    const whereClause: Prisma.ChannelWhereInput = channelId
      ? {
          id: channelId,
          botId,
          type: "whatsapp",
          bot: { tenantId: tenantId },
        }
      : {
          botId,
          type: "whatsapp",
          bot: { tenantId: tenantId },
        };

    const [channel, limitStatus] = await Promise.all([
      db.channel.findFirst({
        where: whereClause,
        include: {
          bot: {
            select: {
              id: true,
              name: true,
            },
          },
          flowAssignments: {
            where: { isActive: true },
            include: {
              flow: {
                select: { id: true, name: true, isActive: true },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      checkChannelLimitWithType(tenantId, botId, "whatsapp"),
    ]);

    if (!channel) {
      return NextResponse.json({ connected: false, limitStatus });
    }

    const config = (channel.config as Prisma.JsonObject | null) || {};

    let provider: string | null = getStringFromJsonConfig(config, "provider");
    let credentialError: string | null = null;
    let masked: Record<string, string | null> = {};

    if (channel.accessToken) {
      try {
        const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);
        provider = envelope.provider;

        if (envelope.provider === "meta_cloud") {
          masked = {
            accessToken: maskSecret(
              (envelope.credentials as { accessToken?: string }).accessToken,
            ),
          };
        }

        if (envelope.provider === "twilio") {
          masked = {
            accountSid: maskSecret(
              (envelope.credentials as { accountSid?: string }).accountSid,
            ),
            authToken: maskSecret(
              (envelope.credentials as { authToken?: string }).authToken,
            ),
          };
        }

        if (envelope.provider === "360dialog") {
          masked = {
            apiKey: maskSecret(
              (envelope.credentials as { apiKey?: string }).apiKey,
            ),
          };
        }
      } catch (error) {
        credentialError =
          error instanceof Error
            ? error.message
            : "Failed to decrypt WhatsApp credentials";
      }
    }

    return NextResponse.json({
      connected: Boolean(
        channel.isActive && channel.enabled && channel.accessToken,
      ),
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        channelId: channel.channelId,
        updatedAt: channel.updatedAt,
        flowAssignments: (channel as any).flowAssignments,
      },
      bot: channel.bot,
      limitStatus,
      provider,
      local: {
        webhookUrl: getStringFromJsonConfig(config, "webhookUrl"),
        webhookConnected: Boolean(config.webhookConnected),
        connectedAt: getStringFromJsonConfig(config, "connectedAt"),
        lastWebhookEventAt: getStringFromJsonConfig(
          config,
          "lastWebhookEventAt",
        ),
        lastInboundMessageAt: getStringFromJsonConfig(
          config,
          "lastInboundMessageAt",
        ),
        lastStatusEventAt: getStringFromJsonConfig(config, "lastStatusEventAt"),
        lastDeliveryError: getStringFromJsonConfig(config, "lastDeliveryError"),
        metaPhoneNumberId: getStringFromJsonConfig(config, "metaPhoneNumberId"),
        twilioFromNumber: getStringFromJsonConfig(config, "twilioFrom"),
      },
      credentialError,
      masked,
      compliance: {
        notes: [
          "Free-form outbound replies are restricted to WhatsApp's 24-hour customer service window.",
          "Outside the window, use approved template messages.",
          "Only official WhatsApp Business Platform providers are supported.",
        ],
      },
    });
  } catch (error) {
    console.error("[WhatsApp Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp status" },
      { status: 500 },
    );
  }
});
