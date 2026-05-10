import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { messageQueue } from "@/lib/queue";
import { decryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import {
  normalizeWhatsAppE164,
  verifyTwilioSignature,
  verifyWebhookSignature,
} from "@/lib/whatsapp-provider";

export const dynamic = "force-dynamic";

type WhatsAppChannelWithBot = {
  id: string;
  botId: string;
  config: Prisma.JsonObject | null;
  accessToken: string | null;
  bot: {
    id: string;
    tenantId: string;
    name: string;
    entryFlow?: string | null;
  };
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: {
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          timestamp?: string;
        }>;
      };
    }>;
  }>;
};

function getVerifyToken(): string | null {
  return (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN?.trim() ||
    null
  );
}

function getAppSecretFallback(): string | null {
  return (
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.FACEBOOK_CLIENT_SECRET?.trim() ||
    null
  );
}

async function getChannelByMetaPhoneId(
  phoneNumberId: string,
): Promise<WhatsAppChannelWithBot | null> {
  return (await prisma.channel.findFirst({
    where: {
      type: "whatsapp",
      isActive: true,
      enabled: true,
      killSwitch: false,
      channelId: phoneNumberId,
    },
    include: {
      bot: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          entryFlow: true,
        },
      },
    },
  })) as WhatsAppChannelWithBot | null;
}

async function getChannelByTwilioToNumber(
  toNumber: string,
): Promise<WhatsAppChannelWithBot | null> {
  const normalized = normalizeWhatsAppE164(toNumber);

  return (await prisma.channel.findFirst({
    where: {
      type: "whatsapp",
      isActive: true,
      enabled: true,
      channelId: normalized,
    },
    include: {
      bot: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          entryFlow: true,
        },
      },
    },
  })) as WhatsAppChannelWithBot | null;
}

function getMetaPhoneNumberId(payload: MetaWebhookPayload): string | null {
  return (
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || null
  );
}

async function ensureContactAndConversation(params: {
  channel: WhatsAppChannelWithBot;
  waId: string;
  profileName?: string;
  rawPhone?: string;
  inboundText: string;
  messageId: string;
  timestamp?: string;
}) {
  await messageQueue.add(
    "whatsapp-message",
    {
      type: "whatsapp",
      botId: params.channel.botId,
      payload: params,
    },
    { jobId: `whatsapp:${params.messageId}` },
  );

  prisma.webhookLog
    .create({
      data: {
        tenantId: params.channel.bot.tenantId,
        type: "message",
        source: "whatsapp",
        event: `meta_message:${params.messageId}`,
        data: {
          channelId: params.channel.id,
          botId: params.channel.botId,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    .catch(() => {});
}

async function processMetaPayload(params: {
  payload: MetaWebhookPayload;
  bodyText: string;
  signature: string | null;
}) {
  if (params.payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  const phoneNumberId = getMetaPhoneNumberId(params.payload);
  if (!phoneNumberId) {
    return NextResponse.json({ received: true, parsed: true }, { status: 200 });
  }

  const channel = await getChannelByMetaPhoneId(phoneNumberId);
  if (!channel || !channel.accessToken) {
    return NextResponse.json({ received: true, matched: false }, { status: 200 });
  }

  const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);
  if (envelope.provider !== "meta_cloud") {
    return NextResponse.json({ received: true, matched: false }, { status: 200 });
  }

  const appSecret =
    (envelope.credentials as { appSecret?: string }).appSecret ||
    getAppSecretFallback();
  if (appSecret) {
    if (!params.signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 403 });
    }
    const isValid = verifyWebhookSignature(
      params.bodyText,
      params.signature,
      appSecret,
    );
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  for (const entry of params.payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      const statusesToLog = [];
      let hasStatuses = false;

      for (const status of value.statuses || []) {
        if (!status.id) continue;
        statusesToLog.push({
          tenantId: channel.bot.tenantId,
          type: "delivery",
          source: "whatsapp",
          event: `meta_status:${status.id}:${status.status || "unknown"}`,
          data: {
            channelId: channel.id,
            botId: channel.botId,
            status,
          } as Prisma.InputJsonValue,
        });
        hasStatuses = true;
      }

      if (hasStatuses) {
        await prisma.webhookLog.createMany({ data: statusesToLog });
        const currentConfig = (channel.config || {}) as Prisma.JsonObject;
        await prisma.channel.update({
          where: { id: channel.id },
          data: {
            config: {
              ...currentConfig,
              lastWebhookEventAt: new Date().toISOString(),
              lastStatusEventAt: new Date().toISOString(),
            } as Prisma.JsonObject,
          },
        });
      }

      for (const message of value.messages || []) {
        if (
          message.type !== "text" ||
          !message.text?.body ||
          !message.from ||
          !message.id
        ) {
          continue;
        }
        ensureContactAndConversation({
          channel,
          waId: message.from,
          profileName: value.contacts?.[0]?.profile?.name,
          rawPhone: message.from,
          inboundText: message.text.body,
          messageId: message.id,
          timestamp: message.timestamp,
        }).catch((err) => {
          logger.error({ error: err }, "[WhatsApp Webhook] Async processing error");
        });
      }
    }
  }

  return NextResponse.json({ received: true, matched: true }, { status: 200 });
}

async function processTwilioPayload(
  params: URLSearchParams,
  requestUrl: string,
  signature: string | null,
) {
  const to = params.get("To");
  const from = params.get("From");
  const body = params.get("Body") || "";
  const messageSid = params.get("MessageSid") || params.get("SmsSid");
  const messageStatus = params.get("MessageStatus");

  if (!to) {
    return NextResponse.json({ received: true, parsed: false }, { status: 200 });
  }

  const channel = await getChannelByTwilioToNumber(to);
  if (!channel || !channel.accessToken) {
    return NextResponse.json({ received: true, matched: false }, { status: 200 });
  }

  const credentialsEnvelope = decryptWhatsAppCredentialEnvelope(
    channel.accessToken,
  );
  if (credentialsEnvelope.provider !== "twilio") {
    return NextResponse.json({ received: true, matched: false }, { status: 200 });
  }

  const authToken = (credentialsEnvelope.credentials as { authToken: string })
    .authToken;
  const isValid = verifyTwilioSignature({
    authToken,
    signature,
    url: requestUrl,
    values: params,
  });

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid Twilio signature" },
      { status: 403 },
    );
  }

  if (messageStatus && messageSid) {
    await prisma.webhookLog.create({
      data: {
        tenantId: channel.bot.tenantId,
        type: "delivery",
        source: "whatsapp",
        event: `twilio_status:${messageSid}:${messageStatus}`,
        data: {
          channelId: channel.id,
          botId: channel.botId,
          messageStatus,
        } as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ received: true, status: true }, { status: 200 });
  }

  if (!from || !messageSid || !body.trim()) {
    return NextResponse.json({ received: true, parsed: false }, { status: 200 });
  }

  ensureContactAndConversation({
    channel,
    waId: from,
    rawPhone: from,
    inboundText: body,
    messageId: messageSid,
  }).catch((err) => {
    logger.error(
      { error: err },
      "[WhatsApp Webhook] Async Twilio processing error",
    );
  });

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = getVerifyToken();
  if (!verifyToken) {
    return NextResponse.json(
      { error: "Webhook verify token is not configured" },
      { status: 500 },
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const bodyText = await req.text();

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(bodyText);
      return processTwilioPayload(
        params,
        req.url,
        req.headers.get("x-twilio-signature"),
      );
    }

    let payload: MetaWebhookPayload;
    try {
      payload = JSON.parse(bodyText || "{}") as MetaWebhookPayload;
    } catch {
      return NextResponse.json({ received: true, parsed: false }, { status: 200 });
    }

    return processMetaPayload({
      payload,
      bodyText,
      signature: req.headers.get("x-hub-signature-256"),
    });
  } catch (error) {
    logger.error({ error }, "[WhatsApp Webhook] Error");
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
