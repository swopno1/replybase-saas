import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantLimits } from "@/lib/subscription";
import {
  type WhatsAppProvider,
  type WhatsAppProviderCredentials,
  validateWhatsAppProviderConnection,
  normalizeWhatsAppE164,
} from "@/lib/whatsapp-provider";
import { encryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";

export const dynamic = "force-dynamic";

const metaSchema = z.object({
  botId: z.string().min(1),
  provider: z.literal("meta_cloud"),
  channelName: z.string().min(1).optional(),
  credentials: z.object({
    accessToken: z.string().min(10),
    phoneNumberId: z.string().min(1),
    businessAccountId: z.string().optional(),
    appSecret: z.string().min(8).optional(),
  }),
});

const twilioSchema = z.object({
  botId: z.string().min(1),
  provider: z.literal("twilio"),
  channelName: z.string().min(1).optional(),
  credentials: z.object({
    accountSid: z.string().min(10),
    authToken: z.string().min(8),
    fromNumber: z.string().min(8),
  }),
});

const dialogSchema = z.object({
  botId: z.string().min(1),
  provider: z.literal("360dialog"),
  channelName: z.string().min(1).optional(),
  credentials: z.object({
    apiKey: z.string().min(8),
    channelId: z.string().min(1),
  }),
});

const connectSchema = z.discriminatedUnion("provider", [
  metaSchema,
  twilioSchema,
  dialogSchema,
]);

function resolveWebhookBaseUrl(req: NextRequest): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");

  if (forwardedProto && host) {
    return `${forwardedProto}://${host}`;
  }

  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = connectSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: validated.botId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    let twilioFromNumber: string | null = null;
    let credentials: WhatsAppProviderCredentials;

    if (validated.provider === "twilio") {
      twilioFromNumber = normalizeWhatsAppE164(
        validated.credentials.fromNumber,
      );
      credentials = {
        ...validated.credentials,
        fromNumber: twilioFromNumber,
      };
    } else {
      credentials = validated.credentials;
    }

    const validationResult = await validateWhatsAppProviderConnection({
      provider: validated.provider as WhatsAppProvider,
      credentials,
    });

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error:
            validationResult.error || "Failed to validate WhatsApp connection",
        },
        { status: 400 },
      );
    }

    const existingChannel = await prisma.channel.findFirst({
      where: {
        botId: bot.id,
        type: "whatsapp",
      },
      select: { id: true },
    });

    if (!existingChannel) {
      const limits = await getTenantLimits(user.tenantId);
      const channelCount = await prisma.channel.count({
        where: { botId: bot.id },
      });

      if (channelCount >= limits.maxChannelsPerBot) {
        return NextResponse.json(
          {
            error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot on your plan)`,
          },
          { status: 403 },
        );
      }
    }

    const encryptedPayload = encryptWhatsAppCredentialEnvelope({
      provider: validated.provider,
      credentials,
    });

    const baseUrl =
      process.env.WHATSAPP_WEBHOOK_BASE_URL?.trim() ||
      resolveWebhookBaseUrl(req);
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/whatsapp/webhook`;

    const nowIso = new Date().toISOString();
    const providerLabel: Record<WhatsAppProvider, string> = {
      meta_cloud: "Meta Cloud API",
      twilio: "Twilio",
      "360dialog": "360dialog",
    };

    const channelName =
      validated.channelName?.trim() ||
      `WhatsApp (${providerLabel[validated.provider as WhatsAppProvider]})`;

    const config: Prisma.JsonObject = {
      provider: validated.provider,
      providerLabel: providerLabel[validated.provider as WhatsAppProvider],
      webhookUrl,
      webhookConnected: true,
      connectedAt: nowIso,
      updatedAt: nowIso,
      lastWebhookEventAt: null,
      lastInboundMessageAt: null,
      lastStatusEventAt: null,
    };

    if (validated.provider === "meta_cloud") {
      config.metaPhoneNumberId = validated.credentials.phoneNumberId;
      if (validated.credentials.businessAccountId) {
        config.metaBusinessAccountId = validated.credentials.businessAccountId;
      }
    }

    if (validated.provider === "twilio" && twilioFromNumber) {
      config.twilioFromNumber = twilioFromNumber;
    }

    if (validated.provider === "360dialog") {
      config.dialogChannelId = validated.credentials.channelId;
    }

    const channel = await prisma.channel.upsert({
      where: {
        botId_type: {
          botId: bot.id,
          type: "whatsapp",
        },
      },
      create: {
        botId: bot.id,
        type: "whatsapp",
        name: channelName,
        channelId:
          validated.provider === "meta_cloud"
            ? validated.credentials.phoneNumberId
            : validated.provider === "twilio"
              ? twilioFromNumber
              : validated.credentials.channelId,
        accessToken: encryptedPayload,
        isActive: true,
        enabled: true,
        killSwitch: false,
        config,
      },
      update: {
        name: channelName,
        channelId:
          validated.provider === "meta_cloud"
            ? validated.credentials.phoneNumberId
            : validated.provider === "twilio"
              ? twilioFromNumber
              : validated.credentials.channelId,
        accessToken: encryptedPayload,
        isActive: true,
        enabled: true,
        killSwitch: false,
        config,
      },
    });

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        provider: validated.provider,
        webhookUrl,
      },
      compliance: {
        policy:
          "Only WhatsApp Business Platform providers are supported (Meta Cloud API, Twilio, 360dialog). Personal WhatsApp automation is not supported.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    console.error("[WhatsApp Connect] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect WhatsApp integration",
      },
      { status: 500 },
    );
  }
}
