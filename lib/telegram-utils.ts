import crypto from "crypto";

export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number; type?: string };
    from?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id?: number;
      chat?: { id?: number; type?: string };
    };
  };
}

export function maskTelegramToken(token: string): string {
  if (token.length < 10) return "***";
  return `${token.slice(0, 5)}...${token.slice(-4)}`;
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function getTelegramUserDisplayName(update: TelegramUpdate): string {
  const from = update.message?.from || update.callback_query?.from;

  if (!from) return "Telegram User";

  const first = from.first_name || "";
  const last = from.last_name || "";
  const fullName = `${first} ${last}`.trim();

  return fullName || from.username || String(from.id || "Telegram User");
}

export function getTelegramChatId(update: TelegramUpdate): string | null {
  const chatId =
    update.message?.chat?.id || update.callback_query?.message?.chat?.id;
  if (typeof chatId !== "number") return null;
  return String(chatId);
}

export function getTelegramUserId(update: TelegramUpdate): string | null {
  const userId = update.message?.from?.id || update.callback_query?.from?.id;
  if (typeof userId !== "number") return null;
  return String(userId);
}

export function getTelegramText(update: TelegramUpdate): string | null {
  if (update.message?.text) return update.message.text;
  if (update.callback_query?.data) return update.callback_query.data;
  return null;
}

export function isTelegramCommand(text: string): boolean {
  return text.startsWith("/");
}
