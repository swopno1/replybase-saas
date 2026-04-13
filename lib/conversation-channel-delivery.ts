import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import {
  normalizeWhatsAppAddress,
  sendWhatsAppText,
} from "@/lib/whatsapp-provider";

export type ConversationDeliveryResult =
  | {
      success: true;
      providerMessageId?: string;
    }
  | {
      success: false;
      code: "not_configured" | "outside_window" | "send_failed";
      message: string;
    };

function getConversationLastInboundAt(
  metadata: Prisma.JsonValue | null,
): Date | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const whatsappNode = (metadata as Prisma.JsonObject).whatsapp;
  if (
    !whatsappNode ||
    typeof whatsappNode !== "object" ||
    Array.isArray(whatsappNode)
  ) {
    return null;
  }

  const lastInboundAt = (whatsappNode as Prisma.JsonObject).lastInboundAt;
  if (typeof lastInboundAt !== "string") {
    return null;
  }

  const parsed = new Date(lastInboundAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function resolveRecipientAddress(contact: {
  phone: string | null;
  identities: Array<{ type: string; value: string }>;
}): string | null {
  const waIdentity = contact.identities.find(
    (identity) => identity.type === "whatsapp_wa_id",
  );

  if (waIdentity?.value) {
    return normalizeWhatsAppAddress(waIdentity.value);
  }

  if (contact.phone) {
    return normalizeWhatsAppAddress(contact.phone);
  }

  return null;
}

export async function deliverConversationMessage(params: {
  conversation: {
    id: string;
    channel: string;
    botId: string | null;
    metadata: Prisma.JsonValue | null;
    contact: {
      phone: string | null;
      identities: Array<{ type: string; value: string }>;
    };
  };
  content: string;
}): Promise<ConversationDeliveryResult> {
  if (params.conversation.channel !== "whatsapp") {
    return { success: true };
  }

  if (!params.conversation.botId) {
    return {
      success: false,
      code: "not_configured",
      message: "This WhatsApp conversation is not linked to a bot channel.",
    };
  }

  const channel = await prisma.channel.findFirst({
    where: {
      botId: params.conversation.botId,
      type: "whatsapp",
      isActive: true,
      enabled: true,
      killSwitch: false,
    },
    select: {
      id: true,
      accessToken: true,
    },
  });

  if (!channel?.accessToken) {
    return {
      success: false,
      code: "not_configured",
      message:
        "WhatsApp channel credentials are missing. Reconnect this bot in Integrations > WhatsApp.",
    };
  }

  const recipient = resolveRecipientAddress(params.conversation.contact);
  if (!recipient) {
    return {
      success: false,
      code: "not_configured",
      message:
        "This contact does not have a WhatsApp number yet. Wait for the first inbound WhatsApp message or add a phone number.",
    };
  }

  const lastInboundAt = getConversationLastInboundAt(
    params.conversation.metadata,
  );
  if (lastInboundAt) {
    const elapsedMs = Date.now() - lastInboundAt.getTime();
    const windowMs = 24 * 60 * 60 * 1000;

    if (elapsedMs > windowMs) {
      return {
        success: false,
        code: "outside_window",
        message:
          "This chat is outside WhatsApp's 24-hour customer service window. Send an approved WhatsApp template message to re-open the conversation.",
      };
    }
  }

  const credentialEnvelope = decryptWhatsAppCredentialEnvelope(
    channel.accessToken,
  );
  const sendResult = await sendWhatsAppText({
    provider: credentialEnvelope.provider,
    credentials: credentialEnvelope.credentials,
    to: recipient,
    text: params.content,
  });

  if (!sendResult.success) {
    return {
      success: false,
      code: "send_failed",
      message: sendResult.error || "Failed to send WhatsApp message",
    };
  }

  return {
    success: true,
    providerMessageId: sendResult.providerMessageId,
  };
}
