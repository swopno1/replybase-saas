import { NextResponse } from "next/server";
import { normalizeWhatsAppE164 } from '@/lib/whatsapp-provider';
import { encryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import { checkChannelLimit } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const body = await req.json();
    const { provider, name, ...credentials } = body;

    const limitStatus = await checkChannelLimit(tenantId, botId);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        {
          error: "Channel limit reached",
          details: `You have reached the maximum of ${limitStatus.limit} channels per bot on the ${limitStatus.planName} plan. Please upgrade.`,
        },
        { status: 403 },
      );
    }

    let normalizedCredentials = {};
    let channelId: string;

    if (provider === "meta_cloud") {
      normalizedCredentials = {
        accessToken: credentials.metaAccessToken,
        phoneNumberId: credentials.metaPhoneNumberId,
        businessAccountId: credentials.metaBusinessId,
        appSecret: credentials.metaAppSecret,
      };
      channelId = credentials.metaPhoneNumberId;
    } else if (provider === "twilio") {
      normalizedCredentials = {
        accountSid: credentials.twilioSid,
        authToken: credentials.twilioAuthToken,
        fromNumber: credentials.twilioFrom,
      };
      channelId = normalizeWhatsAppE164(credentials.twilioFrom);
    } else if (provider === "360dialog") {
      normalizedCredentials = {
        apiKey: credentials.dialogApiKey,
        channelId: credentials.dialogChannelId,
      };
      channelId = credentials.dialogChannelId;
    } else {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const encryptedToken = encryptWhatsAppCredentialEnvelope({
      provider,
      credentials: normalizedCredentials as any,
    });

    const channel = await db.channel.upsert({
      where: {
        type_channelId: {
          type: "whatsapp",
          channelId: String(channelId),
        },
      },
      update: {
        tenantId: tenantId,
        botId,
        name: name || "WhatsApp",
        accessToken: encryptedToken,
        config: {
          provider,
          ...credentials,
        },
        isActive: true,
      },
      create: {
        tenantId: tenantId,
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
});
