import crypto from "crypto";

// --- FACEBOOK SIM ---
export interface FacebookMessageOptions {
  senderPsid: string;
  pageId: string;
  text: string;
  mid?: string;
}

export function generateFacebookWebhookPayload(options: FacebookMessageOptions) {
  return {
    object: "page",
    entry: [
      {
        id: options.pageId,
        time: Date.now(),
        messaging: [
          {
            sender: { id: options.senderPsid },
            recipient: { id: options.pageId },
            timestamp: Date.now(),
            message: {
              mid: options.mid || `mid.${Math.random().toString(36).substr(2, 9)}`,
              text: options.text,
            },
          },
        ],
      },
    ],
  };
}

export function generateFacebookSignature(body: string, appSecret: string) {
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(body, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

// --- TELEGRAM SIM ---
export interface TelegramMessageOptions {
  userId: number;
  chatId: number;
  text: string;
  firstName?: string;
}

export function generateTelegramUpdate(options: TelegramMessageOptions) {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 10000),
      from: {
        id: options.userId,
        is_bot: false,
        first_name: options.firstName || "TestUser",
        username: `user_${options.userId}`,
      },
      chat: {
        id: options.chatId,
        first_name: options.firstName || "TestUser",
        type: "private",
      },
      date: Math.floor(Date.now() / 1000),
      text: options.text,
    },
  };
}

// --- WEBCHAT SIM ---
export interface WebchatMessageOptions {
  visitorId: string;
  conversationId: string;
  text: string;
}

export function generateWebchatInitPayload(publicKey: string, visitorId?: string) {
  return {
    publicKey,
    visitorId,
    metadata: { url: "http://localhost/test" },
  };
}

export function generateWebchatMessagePayload(text: string, conversationId: string) {
  return {
    message: text,
    conversationId,
  };
}
