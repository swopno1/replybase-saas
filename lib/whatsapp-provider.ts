import crypto from "crypto";
import { WHATSAPP_GRAPH_API_VERSION } from "@/lib/meta-config";

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

export async function validateWhatsAppProviderConnection(input: {
  provider: WhatsAppProvider;
  credentials: WhatsAppProviderCredentials;
}): Promise<WhatsAppValidationResult> {
  if (input.provider === "meta_cloud") {
    const credentials = input.credentials as MetaCloudCredentials;
    // Use Authorization header — never put access_token in the URL
    // query string to avoid leaking it in server access logs.
    const url = `${META_GRAPH_BASE}/${encodeURIComponent(credentials.phoneNumberId)}?fields=id,display_phone_number,verified_name`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
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

    return {
      valid: true,
      normalized: {
        phoneNumberId: credentials.phoneNumberId,
      },
    };
  }

  if (input.provider === "twilio") {
    const credentials = input.credentials as TwilioCredentials;
    const auth = Buffer.from(
      `${credentials.accountSid}:${credentials.authToken}`,
    ).toString("base64");

    const response = await fetch(
      `${TWILIO_BASE}/Accounts/${encodeURIComponent(credentials.accountSid)}.json`,
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
        fromNumber: normalizeWhatsAppE164(credentials.fromNumber),
      },
    };
  }

  const credentials = input.credentials as Dialog360Credentials;
  const response = await fetch(`${D360_BASE}/api/v2/contacts`, {
    method: "GET",
    headers: {
      "D360-API-KEY": credentials.apiKey,
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
      channelId: credentials.channelId,
    },
  };
}

export async function sendWhatsAppText(
  input: WhatsAppSendTextInput,
): Promise<WhatsAppSendResult> {
  if (input.provider === "meta_cloud") {
    const credentials = input.credentials as MetaCloudCredentials;
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
          text: input.text,
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
        body: input.text,
      };
    }

    const response = await fetch(
      `${META_GRAPH_BASE}/${encodeURIComponent(credentials.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
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
    const credentials = input.credentials as TwilioCredentials;
    const auth = Buffer.from(
      `${credentials.accountSid}:${credentials.authToken}`,
    ).toString("base64");

    const body = new URLSearchParams({
      To: `whatsapp:${normalizeWhatsAppE164(input.to)}`,
      From: `whatsapp:${normalizeWhatsAppE164(credentials.fromNumber)}`,
      Body: input.text,
    });

    const response = await fetch(
      `${TWILIO_BASE}/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`,
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

  const credentials = input.credentials as Dialog360Credentials;
  const response = await fetch(`${D360_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "D360-API-KEY": credentials.apiKey,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizeWhatsAppAddress(input.to),
      type: "text",
      text: {
        body: input.text,
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
