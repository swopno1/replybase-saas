import crypto from "crypto";
import { WHATSAPP_GRAPH_API_VERSION } from "@/lib/meta-config";
import { formatTextForNonMarkdownChannels } from "@/lib/flow-runtime-utils";

export type WhatsAppProvider = "meta_cloud" | "twilio" | "360dialog";

export type MetaCloudCredentials = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  appSecret?: string;
};

export type TwilioCredentials = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

export type Dialog360Credentials = {
  apiKey: string;
  channelId: string;
};

export type WhatsAppProviderCredentials =
  | MetaCloudCredentials
  | TwilioCredentials
  | Dialog360Credentials;

export interface WhatsAppSendTextInput {
  provider: WhatsAppProvider;
  credentials: WhatsAppProviderCredentials;
  to: string;
  text: string;
  buttons?: Array<{ title: string; payload: string }>;
}

export interface WhatsAppSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  retryAfterSeconds?: number;
}

export interface WhatsAppValidationResult {
  valid: boolean;
  normalized?: Record<string, string>;
  error?: string;
}

const META_GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}`;
const TWILIO_BASE = "https://api.twilio.com/2010-04-01";
const D360_BASE = "https://waba-v2.360dialog.io";

export function normalizeWhatsAppAddress(value: string): string {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^whatsapp:/i, "");
  return withoutPrefix.replace(/[^0-9+]/g, "");
}

export function normalizeWhatsAppE164(value: string): string {
  const normalized = normalizeWhatsAppAddress(value);
  if (normalized.startsWith("+")) {
    return normalized;
  }
  return `+${normalized}`;
}

export function maskSecret(raw?: string | null): string | null {
  if (!raw) {
    return null;
  }

  if (raw.length <= 8) {
    return "********";
  }

  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const maybeMessage = (data as { error?: { message?: string } }).error
    ?.message;
  if (maybeMessage) {
    return maybeMessage;
  }

  const topLevelMessage = (data as { message?: string }).message;
  if (topLevelMessage) {
    return topLevelMessage;
  }

  return fallback;
}

export function normalizeCredentials(
  provider: WhatsAppProvider,
  creds: any,
): WhatsAppProviderCredentials {
  if (provider === "meta_cloud") {
    return {
      accessToken: creds.accessToken || creds.metaAccessToken,
      phoneNumberId: creds.phoneNumberId || creds.metaPhoneNumberId,
      businessAccountId: creds.businessAccountId || creds.metaBusinessId,
      appSecret: creds.appSecret || creds.metaAppSecret,
    };
  }
  if (provider === "twilio") {
    return {
      accountSid: creds.accountSid || creds.twilioSid,
      authToken: creds.authToken || creds.twilioAuthToken,
      fromNumber: creds.fromNumber || creds.twilioFrom,
    };
  }
  if (provider === "360dialog") {
    return {
      apiKey: creds.apiKey || creds.dialogApiKey,
      channelId: creds.channelId || creds.dialogChannelId,
    };
  }
  return creds;
}

export async function validateWhatsAppProviderConnection(input: {
  provider: WhatsAppProvider;
  credentials: WhatsAppProviderCredentials;
}): Promise<WhatsAppValidationResult> {
  const creds = normalizeCredentials(input.provider, input.credentials);

  if (input.provider === "meta_cloud") {
    const meta = creds as MetaCloudCredentials;
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(meta.phoneNumberId)}?fields=id,display_phone_number,verified_name`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${meta.accessToken}`,
      },
    });
    const data = await parseJsonSafe(response);

    if (!response.ok) {
      return {
        valid: false,
        error: toErrorMessage(
          data,
          "Failed to validate Meta Cloud API credentials",
        ),
      };
    }

    // Attempt to verify permissions if possible to catch common configuration errors
    try {
      const permResponse = await fetch(`https://graph.facebook.com/v20.0/me/permissions?access_token=${meta.accessToken}`);
      if (permResponse.ok) {
        const permData = await permResponse.json() as { data: Array<{ permission: string, status: string }> };
        const hasMessaging = permData.data.some(p => p.permission === 'whatsapp_business_messaging' && p.status === 'granted');
        if (!hasMessaging) {
          return {
            valid: false,
            error: "Token is missing 'whatsapp_business_messaging' permission. You can receive messages but cannot send replies. Please re-generate your token with this scope enabled.",
          };
        }
      }
    } catch (permError) {
      // If permission check fails (e.g. due to restricted token), we skip and rely on the phone ID check
      console.warn("[WhatsApp Validation] Permission check skipped:", permError);
    }

    return {
      valid: true,
      normalized: {
        phoneNumberId: meta.phoneNumberId,
      },
    };
  }

  if (input.provider === "twilio") {
    const twilio = creds as TwilioCredentials;
    const auth = Buffer.from(
      `${twilio.accountSid}:${twilio.authToken}`,
    ).toString("base64");

    const response = await fetch(
      `${TWILIO_BASE}/Accounts/${encodeURIComponent(twilio.accountSid)}.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );

    const data = await parseJsonSafe(response);
    if (!response.ok) {
      return {
        valid: false,
        error: toErrorMessage(data, "Failed to validate Twilio credentials"),
      };
    }

    return {
      valid: true,
      normalized: {
        fromNumber: normalizeWhatsAppE164(twilio.fromNumber),
      },
    };
  }

  const d360 = creds as Dialog360Credentials;
  const response = await fetch(`${D360_BASE}/api/v2/contacts`, {
    method: "GET",
    headers: {
      "D360-API-KEY": d360.apiKey,
    },
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    return {
      valid: false,
      error: toErrorMessage(data, "Failed to validate 360dialog credentials"),
    };
  }

  return {
    valid: true,
    normalized: {
      channelId: d360.channelId,
    },
  };
}

export async function sendWhatsAppText(
  input: WhatsAppSendTextInput,
): Promise<WhatsAppSendResult> {
  const creds = normalizeCredentials(input.provider, input.credentials);
  const formattedText = formatTextForNonMarkdownChannels(input.text, { boldToken: "*" });

  if (input.provider === "meta_cloud") {
    const meta = creds as MetaCloudCredentials;
    const body: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizeWhatsAppAddress(input.to),
    };

    if (input.buttons && input.buttons.length > 0) {
      body.type = "interactive";
      body.interactive = {
        type: "button",
        body: {
          text: formattedText,
        },
        action: {
          buttons: input.buttons.slice(0, 3).map((btn, index) => ({
            type: "reply",
            reply: {
              id: btn.payload || `btn_${index}`,
              title: btn.title.slice(0, 20), // WhatsApp limit: 20 chars
            },
          })),
        },
      };
    } else {
      body.type = "text";
      body.text = {
        body: formattedText,
      };
    }

    const response = await fetch(
      `${META_GRAPH_BASE}/${encodeURIComponent(meta.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${meta.accessToken}`,
        },
        body: JSON.stringify(body),
      },
    );

    const data = (await parseJsonSafe(response)) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        success: false,
        error: toErrorMessage(data, "Meta Cloud API send failed"),
      };
    }

    return {
      success: true,
      providerMessageId: data?.messages?.[0]?.id,
    };
  }

  if (input.provider === "twilio") {
    const twilio = creds as TwilioCredentials;
    const auth = Buffer.from(
      `${twilio.accountSid}:${twilio.authToken}`,
    ).toString("base64");

    const body = new URLSearchParams({
      To: `whatsapp:${normalizeWhatsAppE164(input.to)}`,
      From: `whatsapp:${normalizeWhatsAppE164(twilio.fromNumber)}`,
      Body: formattedText,
    });

    const response = await fetch(
      `${TWILIO_BASE}/Accounts/${encodeURIComponent(twilio.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );

    const data = (await parseJsonSafe(response)) as {
      sid?: string;
      message?: string;
      code?: number;
    } | null;

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || "Twilio send failed",
      };
    }

    return {
      success: true,
      providerMessageId: data?.sid,
    };
  }

  const d360 = creds as Dialog360Credentials;
  const response = await fetch(`${D360_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": d360.apiKey,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeWhatsAppAddress(input.to),
      type: "text",
      text: {
        body: formattedText,
      },
    }),
  });

  const data = (await parseJsonSafe(response)) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    return {
      success: false,
      error: toErrorMessage(data, "360dialog send failed"),
    };
  }

  return {
    success: true,
    providerMessageId: data?.messages?.[0]?.id,
  };
}

// ─── WhatsApp Template Types ─────────────────────────────────────────────────

export interface WhatsAppTemplateParameter {
  type: "text";
  text: string;
}

export interface WhatsAppTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: number;
  parameters?: WhatsAppTemplateParameter[];
}

export interface WhatsAppSendTemplateInput {
  provider: WhatsAppProvider;
  credentials: WhatsAppProviderCredentials;
  to: string;
  templateName: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponentDef {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  example?: { body_text?: string[][]; header_text?: string[] };
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: WhatsAppTemplateComponentDef[];
}

export interface WhatsAppTemplateListResult {
  success: boolean;
  templates?: WhatsAppTemplate[];
  error?: string;
}

// ─── Send WhatsApp Template Message ──────────────────────────────────────────

export async function sendWhatsAppTemplate(
  input: WhatsAppSendTemplateInput,
): Promise<WhatsAppSendResult> {
  const creds = normalizeCredentials(input.provider, input.credentials);

  if (input.provider === "meta_cloud" || input.provider === "360dialog") {
    const isMetaCloud = input.provider === "meta_cloud";
    const meta = creds as MetaCloudCredentials;
    const d360 = creds as Dialog360Credentials;

    const baseUrl = isMetaCloud
      ? `${META_GRAPH_BASE}/${encodeURIComponent(meta.phoneNumberId)}/messages`
      : `${D360_BASE}/messages`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isMetaCloud) {
      headers["Authorization"] = `Bearer ${meta.accessToken}`;
    } else {
      headers["D360-API-KEY"] = d360.apiKey;
    }

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: normalizeWhatsAppAddress(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(input.components && input.components.length > 0
          ? { components: input.components }
          : {}),
      },
    };

    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = (await parseJsonSafe(response)) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        success: false,
        error: toErrorMessage(data, "Failed to send WhatsApp template message"),
      };
    }

    return {
      success: true,
      providerMessageId: data?.messages?.[0]?.id,
    };
  }

  if (input.provider === "twilio") {
    const twilio = creds as TwilioCredentials;
    const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");

    // Twilio WhatsApp templates require Content SID — only supported via Twilio Content API.
    // For now, fall back to a text message with the template name so the user knows to configure it there.
    const body = new URLSearchParams({
      To: `whatsapp:${normalizeWhatsAppE164(input.to)}`,
      From: `whatsapp:${normalizeWhatsAppE164(twilio.fromNumber)}`,
      Body: `[Template: ${input.templateName}] — configure this template in your Twilio Content API.`,
    });

    const response = await fetch(
      `${TWILIO_BASE}/Accounts/${encodeURIComponent(twilio.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      },
    );

    const data = (await parseJsonSafe(response)) as { sid?: string; message?: string } | null;
    if (!response.ok) {
      return { success: false, error: data?.message || "Twilio template send failed" };
    }

    return { success: true, providerMessageId: data?.sid };
  }

  return { success: false, error: "Unsupported provider for template sending" };
}

// ─── List WhatsApp Templates (Meta Cloud only) ────────────────────────────────

export async function listWhatsAppTemplates(
  credentials: MetaCloudCredentials,
): Promise<WhatsAppTemplateListResult> {
  if (!credentials.businessAccountId) {
    return {
      success: false,
      error: "WhatsApp Business Account ID (WABA ID) is required to list templates. Add it in your channel settings.",
    };
  }

  const url = `${META_GRAPH_BASE}/${encodeURIComponent(credentials.businessAccountId)}/message_templates?fields=id,name,status,category,language,components&limit=100`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });

  const data = (await parseJsonSafe(response)) as {
    data?: WhatsAppTemplate[];
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    return {
      success: false,
      error: toErrorMessage(data, "Failed to fetch WhatsApp templates"),
    };
  }

  const approved = (data?.data ?? []).filter((t) => t.status === "APPROVED");
  return { success: true, templates: approved };
}

// ─────────────────────────────────────────────────────────────────────────────

export function verifyTwilioSignature(params: {
  authToken: string;
  signature: string | null;
  url: string;
  values: URLSearchParams;
}): boolean {
  if (!params.signature) {
    return false;
  }

  const entries = Array.from(params.values.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const payload =
    params.url + entries.map(([key, value]) => `${key}${value}`).join("");

  const expected = crypto
    .createHmac("sha1", params.authToken)
    .update(payload, "utf8")
    .digest("base64");

  const provided = params.signature.trim();

  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string,
): boolean {
  if (!signature.startsWith("sha256=")) return false;

  const sig = signature.substring(7); // remove 'sha256='
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  // Convert hex strings to Buffers for timing-safe comparison
  const sigBuffer = Buffer.from(sig, "hex");
  const expectedSigBuffer = Buffer.from(expectedSig, "hex");

  // Ensure both buffers are the same length
  if (sigBuffer.length !== expectedSigBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedSigBuffer);
}
