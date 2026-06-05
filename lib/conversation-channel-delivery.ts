import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import {
  normalizeWhatsAppAddress,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  type WhatsAppTemplateComponent,
} from "@/lib/whatsapp-provider";
import { sendTextMessage as sendFacebookTextMessage } from "@/lib/facebook-sender";
import { formatTextForNonMarkdownChannels } from "@/lib/flow-runtime-utils";

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
  if (params.conversation.channel === "facebook") {
    return deliverFacebookMessage(params);
  }

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

  // No inbound ever received = business is initiating first contact.
  // WhatsApp requires an approved template for business-initiated conversations.
  if (!lastInboundAt) {
    return {
      success: false,
      code: "outside_window",
      message:
        "No message has been received from this contact yet. Use a WhatsApp template message to initiate the conversation.",
    };
  }

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

  const credentialEnvelope = decryptWhatsAppCredentialEnvelope(
    channel.accessToken,
  );
  const sendResult = await sendWhatsAppText({
    provider: credentialEnvelope.provider,
    credentials: credentialEnvelope.credentials,
    to: recipient,
    text: formatTextForNonMarkdownChannels(params.content, { boldToken: "*" }),
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

async function deliverFacebookMessage(params: {
  conversation: {
    id: string;
    botId: string | null;
    contact: {
      identities: Array<{ type: string; value: string }>;
    };
  };
  content: string;
}): Promise<ConversationDeliveryResult> {
  const psidIdentity = params.conversation.contact.identities.find(
    (i) => i.type === "facebook_psid",
  );

  if (!psidIdentity?.value) {
    return {
      success: false,
      code: "not_configured",
      message:
        "This contact does not have a Facebook PSID. Wait for the first inbound Facebook message.",
    };
  }

  // Look up the CRM conversation to find the facebookPage
  const crmConversation = await prisma.crmConversation.findUnique({
    where: { id: params.conversation.id },
    select: { facebookPageId: true },
  });

  if (!crmConversation?.facebookPageId) {
    return {
      success: false,
      code: "not_configured",
      message: "This conversation is not linked to a Facebook Page.",
    };
  }

  const facebookPage = await prisma.facebookPage.findUnique({
    where: { id: crmConversation.facebookPageId },
    select: { accessToken: true },
  });

  if (!facebookPage?.accessToken) {
    return {
      success: false,
      code: "not_configured",
      message: "Facebook Page access token is missing. Reconnect in Integrations > Facebook.",
    };
  }

  const result = await sendFacebookTextMessage(
    facebookPage.accessToken,
    psidIdentity.value,
    formatTextForNonMarkdownChannels(params.content),
  );

  if (!result.success) {
    return {
      success: false,
      code: "send_failed",
      message: result.error || "Failed to send Facebook message.",
    };
  }

  return { success: true, providerMessageId: result.messageId };
}

// ─── Template Delivery (bypasses 24-hour window) ─────────────────────────────

export async function deliverConversationTemplate(params: {
  conversation: {
    id: string;
    channel: string;
    botId: string | null;
    contact: {
      phone: string | null;
      identities: Array<{ type: string; value: string }>;
    };
  };
  templateName: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
}): Promise<ConversationDeliveryResult> {
  if (params.conversation.channel !== "whatsapp") {
    return {
      success: false,
      code: "not_configured",
      message: "Template messages are only supported on WhatsApp.",
    };
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
    select: { id: true, accessToken: true },
  });

  if (!channel?.accessToken) {
    return {
      success: false,
      code: "not_configured",
      message: "WhatsApp channel credentials are missing. Reconnect in Integrations > WhatsApp.",
    };
  }

  const recipient = resolveRecipientAddress(params.conversation.contact);
  if (!recipient) {
    return {
      success: false,
      code: "not_configured",
      message: "This contact does not have a WhatsApp number. Add a phone number to the contact first.",
    };
  }

  const credentialEnvelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);
  const sendResult = await sendWhatsAppTemplate({
    provider: credentialEnvelope.provider,
    credentials: credentialEnvelope.credentials,
    to: recipient,
    templateName: params.templateName,
    languageCode: params.languageCode,
    components: params.components,
  });

  if (!sendResult.success) {
    return {
      success: false,
      code: "send_failed",
      message: sendResult.error || "Failed to send WhatsApp template message",
    };
  }

  return { success: true, providerMessageId: sendResult.providerMessageId };
}
