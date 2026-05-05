import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/server/facebook-utils";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import logger from "@/lib/logger";
import {
  decryptWhatsAppCredentialEnvelope,
  getStringFromJsonConfig,
} from "@/lib/whatsapp-channel-credentials";
import { messageQueue } from "@/lib/queue";
import {
  normalizeWhatsAppE164,
  verifyTwilioSignature,
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

async function getActiveWhatsAppChannels(): Promise<WhatsAppChannelWithBot[]> {
  const rows = await prisma.channel.findMany({
    where: {
      type: "whatsapp",
      isActive: true,
      enabled: true,
      killSwitch: false,
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
  });

  return rows as WhatsAppChannelWithBot[];
}

function getMetaPhoneNumberId(payload: MetaWebhookPayload): string | null {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) {
        continue;
      }
      if (value.metadata?.phone_number_id) {
        return value.metadata.phone_number_id;
      }
    }
  }

  return null;
}

function getChannelByMetaPhoneId(
  channels: WhatsAppChannelWithBot[],
  phoneNumberId: string,
): WhatsAppChannelWithBot | null {
  for (const channel of channels) {
    const config = (channel.config || {}) as Prisma.JsonObject;
    const configuredPhoneId = config.metaPhoneNumberId;

    if (
      typeof configuredPhoneId === "string" &&
      configuredPhoneId === phoneNumberId
    ) {
      return channel;
    }
  }

  return null;
}

function getChannelByTwilioToNumber(
  channels: WhatsAppChannelWithBot[],
  toNumber: string,
): WhatsAppChannelWithBot | null {
  const normalized = normalizeWhatsAppE164(toNumber);

  for (const channel of channels) {
    const config = (channel.config || {}) as Prisma.JsonObject;
    const configuredFrom = config.twilioFromNumber;

    if (
      typeof configuredFrom === "string" &&
      normalizeWhatsAppE164(configuredFrom) === normalized
    ) {
      return channel;
    }
  }

  return null;
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
  // Use messageId as jobId for BullMQ idempotency.
  // This ensures that if Meta retries the webhook, we don't process the same message twice.
  await messageQueue.add(
    "whatsapp-message",
    { type: "whatsapp", payload: params },
    { jobId: `whatsapp:${params.messageId}` }
  );

  // Log the event asynchronously for audit purposes
  prisma.webhookLog.create({
    data: {
      type: "message",
      source: "whatsapp",
      event: `meta_message:${params.messageId}`,
      data: { channelId: params.channel.id } as Prisma.InputJsonValue,
    },
    select: { id: true },
  }).catch(() => {
    /* audit logging is best-effort */
  });
}

async function processMetaPayload(params: {
  payload: MetaWebhookPayload;
  bodyText: string;
  signature: string | null;
}) {
  // Meta sends this field on every webhook to identify the product area.
  // Reject anything that is not a WhatsApp Business Account notification so
  // that cross-product webhooks (Instagram, Messenger) never trigger replies.
  if (params.payload.object !== "whatsapp_business_account") {
    return NextResponse.json(
      { received: true, ignored: true },
      { status: 200 },
    );
  }

  const channels = await getActiveWhatsAppChannels();
  if (channels.length === 0) {
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 },
    );
  }

  const phoneNumberId = getMetaPhoneNumberId(params.payload);
  if (!phoneNumberId) {
    return NextResponse.json({ received: true, parsed: true }, { status: 200 });
  }

  const channel = getChannelByMetaPhoneId(channels, phoneNumberId);
  if (!channel) {
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 },
    );
  }

  if (!channel.accessToken) {
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 },
    );
  }

  const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);
  if (envelope.provider !== "meta_cloud") {
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 },
    );
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
      if (!value) {
        continue;
      }

      const statusesToLog = [];
      let hasStatuses = false;

      for (const status of value.statuses || []) {
        if (!status.id) {
          continue;
        }

        statusesToLog.push({
          type: "delivery",
          source: "whatsapp",
          event: `meta_status:${status.id}:${status.status || "unknown"}`,
          data: {
            channelId: channel.id,
            status,
          } as Prisma.InputJsonValue,
        });
        hasStatuses = true;
      }

      if (hasStatuses) {
        await prisma.webhookLog.createMany({
          data: statusesToLog,
        });

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

        // Process asynchronously. Since we are on a DigitalOcean Droplet (Node.js runtime),
        // we can safely fire-and-forget without @vercel/functions waitUntil.
        ensureContactAndConversation({
          channel,
          waId: message.from,
          profileName: value.contacts?.[0]?.profile?.name,
          rawPhone: message.from,
          inboundText: message.text.body,
          messageId: message.id,
          timestamp: message.timestamp,
        }).catch((err) => {
          logger.error(
            { error: err },
            "[WhatsApp Webhook] Async processing error",
          );
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
    return NextResponse.json(
      { received: true, parsed: false },
      { status: 200 },
    );
  }

  const channels = await getActiveWhatsAppChannels();
  const channel = getChannelByTwilioToNumber(channels, to);

  if (!channel || !channel.accessToken) {
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 },
    );
  }

  const credentialsEnvelope = decryptWhatsAppCredentialEnvelope(
    channel.accessToken,
  );
  if (credentialsEnvelope.provider !== "twilio") {
    return NextResponse.json(
      { received: true, matched: false },
      { status: 200 },
    );
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
        type: "delivery",
        source: "whatsapp",
        event: `twilio_status:${messageSid}:${messageStatus}`,
        data: {
          channelId: channel.id,
          messageStatus,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ received: true, status: true }, { status: 200 });
  }

  if (!from || !messageSid || !body.trim()) {
    return NextResponse.json(
      { received: true, parsed: false },
      { status: 200 },
    );
  }

  // Process asynchronously. Since we are on a DigitalOcean Droplet (Node.js runtime),
  // we can safely fire-and-forget without @vercel/functions waitUntil.
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
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

// Meta webhook verification handshake.
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

    // Twilio sends x-www-form-urlencoded by default.
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
      return NextResponse.json(
        { received: true, parsed: false },
        { status: 200 },
      );
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
