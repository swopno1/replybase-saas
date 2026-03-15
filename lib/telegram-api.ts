const TELEGRAM_API_BASE = "https://api.telegram.org";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
}

export interface TelegramBotProfile {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_message?: string;
  last_error_date?: number;
  max_connections?: number;
}

export interface TelegramSendMessageResult {
  success: boolean;
  messageId?: number;
  error?: string;
  retryAfterSeconds?: number;
}

function buildApiUrl(token: string, method: string): string {
  return `${TELEGRAM_API_BASE}/bot${token}/${method}`;
}

async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResponse<T>> {
  const response = await fetch(buildApiUrl(token, method), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  return data;
}

export async function getMe(token: string): Promise<TelegramBotProfile> {
  const data = await callTelegram<TelegramBotProfile>(token, "getMe");
  if (!data.ok || !data.result) {
    throw new Error(data.description || "Failed to validate Telegram token");
  }
  return data.result;
}

export async function setTelegramWebhook(params: {
  token: string;
  webhookUrl: string;
  secretToken: string;
  allowedUpdates?: string[];
}): Promise<boolean> {
  const data = await callTelegram<boolean>(params.token, "setWebhook", {
    url: params.webhookUrl,
    secret_token: params.secretToken,
    allowed_updates: params.allowedUpdates || ["message", "callback_query"],
    drop_pending_updates: false,
  });

  if (!data.ok) {
    throw new Error(data.description || "Failed to set Telegram webhook");
  }

  return true;
}

export async function deleteTelegramWebhook(
  token: string,
  dropPendingUpdates = false,
): Promise<boolean> {
  const data = await callTelegram<boolean>(token, "deleteWebhook", {
    drop_pending_updates: dropPendingUpdates,
  });

  if (!data.ok) {
    throw new Error(data.description || "Failed to delete Telegram webhook");
  }

  return true;
}

export async function getTelegramWebhookInfo(
  token: string,
): Promise<TelegramWebhookInfo> {
  const data = await callTelegram<TelegramWebhookInfo>(token, "getWebhookInfo");
  if (!data.ok || !data.result) {
    throw new Error(data.description || "Failed to fetch webhook status");
  }
  return data.result;
}

export async function sendTelegramTextMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<TelegramSendMessageResult> {
  const data = await callTelegram<{ message_id: number }>(
    token,
    "sendMessage",
    {
      chat_id: chatId,
      text,
    },
  );

  if (!data.ok) {
    return {
      success: false,
      error: data.description || "Telegram sendMessage failed",
      retryAfterSeconds: data.parameters?.retry_after,
    };
  }

  return {
    success: true,
    messageId: data.result?.message_id,
  };
}

export async function answerTelegramCallbackQuery(
  token: string,
  callbackQueryId: string,
): Promise<boolean> {
  const data = await callTelegram<boolean>(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
  });

  if (!data.ok) {
    return false;
  }

  return true;
}
