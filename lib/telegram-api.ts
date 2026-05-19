const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_TELEGRAM_TIMEOUT_MS = 10_000;
const TELEGRAM_MAX_RETRIES = 3;

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

function getTelegramTimeoutMs(): number {
  const raw = process.env.TELEGRAM_API_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_TELEGRAM_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 60_000) {
    return DEFAULT_TELEGRAM_TIMEOUT_MS;
  }

  return parsed;
}

async function callTelegram<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
  timeoutMs = getTelegramTimeoutMs(),
): Promise<TelegramApiResponse<T>> {
  const response = await fetch(buildApiUrl(token, method), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  let data: TelegramApiResponse<T>;
  try {
    data = (await response.json()) as TelegramApiResponse<T>;
  } catch {
    data = {
      ok: false,
      description: "Telegram API returned a non-JSON response",
    };
  }

  if (!response.ok && !data.description) {
    data.description = `Telegram API request failed with HTTP ${response.status}`;
    data.error_code = response.status;
  }

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

function formatTelegramText(text: string): string {
  if (!text) return "";

  // Escape raw HTML entities to prevent Telegram API parsing failures
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 1. Convert markdown links: [Title](Url) -> <a href="Url">Title</a>
  escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (_, title, url) => {
    return `<a href="${url}">${title}</a>`;
  });

  // 2. Convert bold markers: **bold** -> <b>bold</b>
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, (_, boldText) => {
    return `<b>${boldText}</b>`;
  });

  return escaped;
}

export async function sendTelegramTextMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<TelegramSendMessageResult> {
  const formattedText = formatTelegramText(text);

  const attemptSend = async () =>
    callTelegram<{ message_id: number }>(token, "sendMessage", {
      chat_id: chatId,
      text: formattedText,
      parse_mode: "HTML",
    });

  let data: TelegramApiResponse<{ message_id: number }> | null = null;

  for (let attempt = 1; attempt <= TELEGRAM_MAX_RETRIES; attempt += 1) {
    try {
      data = await attemptSend();
    } catch (error) {
      if (attempt === TELEGRAM_MAX_RETRIES) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Telegram sendMessage request failed",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      continue;
    }

    if (data.ok) {
      break;
    }

    const isRateLimited = data.error_code === 429;
    const retryAfterMs = data.parameters?.retry_after
      ? Math.min(data.parameters.retry_after * 1000, 30_000)
      : Math.min(attempt * 1_500, 5_000);

    if (!isRateLimited || attempt === TELEGRAM_MAX_RETRIES) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
  }

  if (!data) {
    return {
      success: false,
      error: "Telegram sendMessage did not return a response",
    };
  }

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

export async function sendTelegramChatAction(
  token: string,
  chatId: string,
  action: "typing" | "upload_document" | "record_voice" = "typing",
): Promise<boolean> {
  const data = await callTelegram<true>(token, "sendChatAction", {
    chat_id: chatId,
    action,
  });
  return Boolean(data?.ok);
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
