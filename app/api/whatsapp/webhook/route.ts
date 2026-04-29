import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { verifyWebhookSignature } from "@/lib/server/facebook-utils";
import { prisma } from "@/lib/prisma";
// AI fallback removed April 2026
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import { waitForFlowDurationMs } from "@/lib/flow-runtime-utils";
import {
  decryptWhatsAppCredentialEnvelope,
  getStringFromJsonConfig,
} from "@/lib/whatsapp-channel-credentials";
import {
  // ...existing code...
  WhatsAppProviderCredentials,
  normalizeWhatsAppAddress,
  normalizeWhatsAppE164,
  sendWhatsAppText,
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
  const normalizedWaId = normalizeWhatsAppAddress(params.waId);
  const normalizedPhone = params.rawPhone
    ? normalizeWhatsAppE164(params.rawPhone)
    : null;

  let contact = await prisma.contact.findFirst({
    where: {
      tenantId: params.channel.bot.tenantId,
      identities: {
        some: {
          type: "whatsapp_wa_id",
          value: normalizedWaId,
        },
      },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: params.channel.bot.tenantId,
        name: params.profileName || null,
        phone: normalizedPhone,
        identities: {
          create: [
            {
              type: "whatsapp_wa_id",
              value: normalizedWaId,
            },
            ...(normalizedPhone
              ? [
                  {
                    type: "whatsapp_phone_e164",
                    value: normalizedPhone,
                  },
                ]
              : []),
          ],
        },
      },
    });
  } else {
    await prisma.contactIdentity.upsert({
      where: {
        contactId_type_value: {
          contactId: contact.id,
          type: "whatsapp_wa_id",
          value: normalizedWaId,
        },
      },
      update: {},
      create: {
        contactId: contact.id,
        type: "whatsapp_wa_id",
        value: normalizedWaId,
      },
    });

    if (normalizedPhone) {
      await prisma.contactIdentity.upsert({
        where: {
          contactId_type_value: {
            contactId: contact.id,
            type: "whatsapp_phone_e164",
            value: normalizedPhone,
          },
        },
        update: {},
        create: {
          contactId: contact.id,
          type: "whatsapp_phone_e164",
          value: normalizedPhone,
        },
      });
    }

    if (!contact.name && params.profileName) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          name: params.profileName,
          phone: contact.phone || normalizedPhone,
        },
      });
    }
  }

  let conversation = await prisma.crmConversation.findFirst({
    where: {
      contactId: contact.id,
      botId: params.channel.botId,
      channel: "whatsapp",
    },
  });

  if (!conversation) {
    conversation = await prisma.crmConversation.create({
      data: {
        contactId: contact.id,
        botId: params.channel.botId,
        channel: "whatsapp",
      },
    });
  }

  const existingEvent = await prisma.webhookLog.findFirst({
    where: {
      source: "whatsapp",
      event: `meta_message:${params.messageId}`,
    },
    select: { id: true },
  });

  if (existingEvent) {
    return;
  }

  // Create the dedup sentinel atomically. If a concurrent request already
  // inserted this event (race between the findFirst above and this create),
  // Prisma will throw a unique-constraint error (P2002) which we treat as
  // "already processed" and return early — preventing duplicate AI replies.
  try {
    await prisma.webhookLog.create({
      data: {
        type: "message",
        source: "whatsapp",
        event: `meta_message:${params.messageId}`,
        data: {
          channelId: params.channel.id,
          conversationId: conversation.id,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err: unknown) {
    const isPrismaUniqueViolation =
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2002";
    if (isPrismaUniqueViolation) {
      // Another concurrent request already processed this message ID — skip.
      return;
    }
    throw err;
  }

  await prisma.crmMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      content: params.inboundText,
      source: "human",
    },
  });

  const currentMetadata =
    conversation.metadata &&
    typeof conversation.metadata === "object" &&
    !Array.isArray(conversation.metadata)
      ? (conversation.metadata as Prisma.JsonObject)
      : {};

  await prisma.crmConversation.update({
    where: { id: conversation.id },
    data: {
      metadata: {
        ...currentMetadata,
        whatsapp: {
          provider: getStringFromJsonConfig(params.channel.config, "provider"),
          waId: normalizedWaId,
          lastInboundAt: new Date(
            params.timestamp ? Number(params.timestamp) * 1000 : Date.now(),
          ).toISOString(),
          lastInboundMessageId: params.messageId,
          phoneNumberId: getStringFromJsonConfig(
            params.channel.config,
            "metaPhoneNumberId",
          ),
        },
      } as Prisma.InputJsonValue,
    },
  });

  const currentConfig = (params.channel.config || {}) as Prisma.JsonObject;
  await prisma.channel.update({
    where: { id: params.channel.id },
    data: {
      config: {
        ...currentConfig,
        lastWebhookEventAt: new Date().toISOString(),
        lastInboundMessageAt: new Date().toISOString(),
      } as Prisma.JsonObject,
    },
  });

  // ------------------------------------------------------------------ //
  //  AI AUTO-REPLY                                                        //
  // ------------------------------------------------------------------ //
  await sendAutoReply({
    channel: params.channel,
    toWaId: normalizedWaId,
    contactId: contact.id,
    contactName: contact.name ?? undefined,
    inboundText: params.inboundText,
    conversation,
  });
}

async function sendAutoReply(params: {
  channel: WhatsAppChannelWithBot;
  toWaId: string;
  contactId: string;
  contactName?: string;
  inboundText: string;
  conversation: { id: string };
}) {
  // Resolve credentials for outbound send.
  if (!params.channel.accessToken) {
    return;
  }

  let envelope: ReturnType<typeof decryptWhatsAppCredentialEnvelope>;
  try {
    envelope = decryptWhatsAppCredentialEnvelope(params.channel.accessToken);
  } catch {
    return;
  }

  let replyText: string | null = null;
  let replySource: "flow" | "ai" = "ai";

  try {
    const flowResult = await executeBotEntryFlowFirst({
      tenantId: params.channel.bot.tenantId,
      contactId: params.contactId,
      scopeKey: `whatsapp:${params.channel.id}`,
      message: params.inboundText,
      channelId: params.channel.id,
      entryFlow: params.channel.bot.entryFlow ?? undefined,
      variables: {
        channel: "whatsapp",
        waId: params.toWaId,
      },
    });

    const flowResponses = flowResult?.responses ?? [];
    const hasFlowText = flowResponses.some((r) => r.type === "text" && r.text);

    if (hasFlowText) {
      const WA_MAX = 4096;
      for (const resp of flowResponses) {
        if (resp.type === "typing" && resp.durationMs > 0) {
          // WhatsApp has no typing indicator API — pause between messages
          await waitForFlowDurationMs(Math.min(resp.durationMs, 2000));
        } else if (resp.type === "text" && resp.text) {
          let text = resp.text;
          if (text.length > WA_MAX) {
            text = text.slice(0, WA_MAX - 3) + "...";
          }
          const sendResult = await sendWhatsAppText({
            provider: envelope.provider,
            credentials: envelope.credentials as WhatsAppProviderCredentials,
            to: params.toWaId,
            text,
          });
          if (sendResult.success) {
            await prisma.crmMessage
              .create({
                data: {
                  conversationId: params.conversation.id,
                  direction: "outbound",
                  content: text,
                  source: "flow",
                },
              })
              .catch(() => {});
          }
        }
      }

      await Promise.allSettled([
        recordMilestoneEvent(params.channel.bot.tenantId, "first-channel", {
          channelType: "whatsapp",
          channelId: params.channel.id,
        }),
        recordMilestoneEvent(
          params.channel.bot.tenantId,
          "first-automated-reply",
          { channelType: "whatsapp", source: "flow" },
        ),
      ]);

      return;
    }
  } catch (error) {
    console.error("[WhatsApp Webhook] Flow engine error:", error);
  }

  // AI fallback if flow did not return text
  try {
    const { aiFallback } = await import("@/lib/ai-fallback");
    // Fetch last messages for context
    const lastMessages = await prisma.crmMessage.findMany({
      where: { conversationId: params.conversation.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true, source: true },
    });
    const aiMessages = lastMessages.reverse().map((msg) => ({
      role: (msg.source === "human" ? "user" : "assistant") as any,
      content: msg.content,
    }));
    aiMessages.push({ role: "user" as any, content: params.inboundText });

    // Use tenant subscription plan name (fallback to "free")
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: params.channel.bot.tenantId },
      select: { plan: { select: { name: true } } },
    });
    const planName = subscription?.plan?.name || "free";

    const aiStream = await aiFallback({
      botId: params.channel.botId,
      conversationId: params.conversation.id,
      messages: aiMessages,
      planName,
    });
    replyText =
      aiStream && "text" in aiStream
        ? await aiStream.text
        : String(aiStream ?? "");
    replySource = "ai";
  } catch (aiError) {
    replyText = "Our AI Agent is under development! We'll be up again soon.";
    replySource = "ai";
  }

  // WhatsApp text messages are capped at 4096 characters.
  // Truncate gracefully rather than letting the send fail.
  const WHATSAPP_MAX_TEXT_LENGTH = 4096;
  if (replyText.length > WHATSAPP_MAX_TEXT_LENGTH) {
    const originalLength = replyText.length;
    replyText = replyText.slice(0, WHATSAPP_MAX_TEXT_LENGTH - 3) + "...";
    await prisma.webhookLog
      .create({
        data: {
          type: "delivery_warning",
          source: "whatsapp",
          event: `reply_truncated:${params.channel.id}`,
          data: {
            toWaId: params.toWaId,
            originalLength,
            maxLength: WHATSAPP_MAX_TEXT_LENGTH,
          } as Prisma.InputJsonValue,
        },
      })
      .catch(() => {
        // Best effort only.
      });
  }

  const sendResult = await sendWhatsAppText({
    provider: envelope.provider,
    credentials: envelope.credentials as WhatsAppProviderCredentials,
    to: params.toWaId,
    text: replyText,
  });

  if (sendResult.success) {
    try {
      await prisma.crmMessage.create({
        data: {
          conversationId: params.conversation.id,
          direction: "outbound",
          content: replyText,
          source: replySource,
        },
      });
    } catch (error) {
      console.error(
        "[WhatsApp Webhook] Failed to persist outbound message:",
        error,
      );
    }

    // Best-effort milestone tracking.
    await Promise.allSettled([
      recordMilestoneEvent(params.channel.bot.tenantId, "first-channel", {
        channelType: "whatsapp",
        channelId: params.channel.id,
      }),
      recordMilestoneEvent(
        params.channel.bot.tenantId,
        "first-automated-reply",
        {
          channelType: "whatsapp",
          source: replySource,
        },
      ),
    ]);

    // Update delivery success in channel config.
    const currentConfig = (params.channel.config || {}) as Prisma.JsonObject;
    await prisma.channel
      .update({
        where: { id: params.channel.id },
        data: {
          config: {
            ...currentConfig,
            lastDeliverySuccessAt: new Date().toISOString(),
            lastDeliveryError: null,
            lastDeliveryErrorAt: null,
          } as Prisma.JsonObject,
        },
      })
      .catch((err) => {
        console.error(
          "[WhatsApp Webhook] Failed to update delivery success config:",
          err,
        );
      });
  } else {
    await prisma.webhookLog
      .create({
        data: {
          type: "delivery_error",
          source: "whatsapp",
          event: `send_error:${params.channel.id}`,
          data: {
            toWaId: params.toWaId,
            error: sendResult.error || "Unknown WhatsApp send error",
          } as Prisma.InputJsonValue,
        },
      })
      .catch(() => {
        // Best effort only.
      });

    const currentConfig = (params.channel.config || {}) as Prisma.JsonObject;
    await prisma.channel
      .update({
        where: { id: params.channel.id },
        data: {
          config: {
            ...currentConfig,
            lastDeliveryError:
              sendResult.error || "Unknown WhatsApp send error",
            lastDeliveryErrorAt: new Date().toISOString(),
          } as Prisma.JsonObject,
        },
      })
      .catch(() => {
        // Best effort only.
      });
  }
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

      for (const status of value.statuses || []) {
        if (!status.id) {
          continue;
        }

        await prisma.webhookLog.create({
          data: {
            type: "delivery",
            source: "whatsapp",
            event: `meta_status:${status.id}:${status.status || "unknown"}`,
            data: {
              channelId: channel.id,
              status,
            } as Prisma.InputJsonValue,
          },
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

        await ensureContactAndConversation({
          channel,
          waId: message.from,
          profileName: value.contacts?.[0]?.profile?.name,
          rawPhone: message.from,
          inboundText: message.text.body,
          messageId: message.id,
          timestamp: message.timestamp,
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

  await ensureContactAndConversation({
    channel,
    waId: from,
    rawPhone: from,
    inboundText: body,
    messageId: messageSid,
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
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
