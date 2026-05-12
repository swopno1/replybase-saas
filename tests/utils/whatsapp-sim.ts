import crypto from "node:crypto";

export interface MetaMessageOptions {
  from: string;
  body?: string;
  messageId: string;
  phoneNumberId: string;
  profileName?: string;
  timestamp?: string;
  type?: "text" | "image" | "audio" | "video" | "document" | "button" | "interactive";
  mediaCaption?: string;
  filename?: string;
  buttonText?: string;
}

export function generateMetaWebhookPayload(options: MetaMessageOptions) {
  const messageType = options.type || "text";
  const message: any = {
    id: options.messageId,
    from: options.from,
    timestamp: options.timestamp || Math.floor(Date.now() / 1000).toString(),
    type: messageType,
  };

  if (messageType === "text") {
    message.text = { body: options.body || "" };
  } else if (messageType === "image") {
    message.image = { caption: options.mediaCaption || "", id: "media_123" };
  } else if (messageType === "audio") {
    message.audio = { id: "media_123", mime_type: "audio/ogg" };
  } else if (messageType === "document") {
    message.document = { filename: options.filename || "doc.pdf", id: "media_123" };
  } else if (messageType === "button") {
    message.button = { text: options.buttonText || "Click Me" };
  }

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_id",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "123456789",
                phone_number_id: options.phoneNumberId,
              },
              contacts: [
                {
                  wa_id: options.from,
                  profile: {
                    name: options.profileName || "Test User",
                  },
                },
              ],
              messages: [message],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

export function generateMetaSignature(payload: string, appSecret: string) {
  const hash = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");
  return `sha256=${hash}`;
}

export function generateTwilioPayload(options: {
  to: string;
  from: string;
  body: string;
  messageSid: string;
}) {
  const params = new URLSearchParams({
    To: `whatsapp:${options.to}`,
    From: `whatsapp:${options.from}`,
    Body: options.body,
    MessageSid: options.messageSid,
    SmsSid: options.messageSid,
    AccountSid: "AC_TEST",
  });
  return params;
}

export function generateTwilioSignature(
  authToken: string,
  url: string,
  params: URLSearchParams,
) {
  const entries = Array.from(params.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const payload = url + entries.map(([key, value]) => `${key}${value}`).join("");
  return crypto
    .createHmac("sha1", authToken)
    .update(payload, "utf8")
    .digest("base64");
}
