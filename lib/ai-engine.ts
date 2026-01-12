import { z } from "zod";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL;
const BOTPRESS_SERVICE_TOKEN = process.env.BOTPRESS_SERVICE_TOKEN;

export class AiEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiEngineError";
  }
}

function assertServerConfig() {
  if (!AI_ENGINE_URL || !BOTPRESS_SERVICE_TOKEN) {
    console.error("[AI Engine] Service is not configured.");
    throw new AiEngineError("Service unavailable");
  }
}

/**
 * Checks the health of the AI engine.
 * @returns A promise that resolves to an object indicating the engine status.
 */
export async function checkHealth() {
  assertServerConfig();
  try {
    const response = await fetch(`${AI_ENGINE_URL}/api/v1/bots`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BOTPRESS_SERVICE_TOKEN}`,
      },
      cache: "no-store",
    });

    if (response.status === 200 || response.status === 401) {
      return { engine: "ok", provider: "ai-engine" };
    } else {
      console.warn(
        `[AI Engine] Health check failed with status: ${response.status}`
      );
      return { engine: "down", reason: "unreachable" };
    }
  } catch (error) {
    console.error("[AI Engine] Health check request failed:", error);
    return { engine: "down", reason: "unreachable" };
  }
}

export const ConverseInputSchema = z.object({
  botId: z.string().min(1),
  userId: z.string().min(1),
  message: z.string().min(1),
});

/**
 * Sends a message to a bot and returns the response.
 * @param botId The ID of the bot.
 * @param userId The ID of the user.
 * @param message The message to send.
 * @returns A promise that resolves to the bot's response.
 */
export async function converse(
  botId: string,
  userId: string,
  message: string
) {
  assertServerConfig();

  try {
    const response = await fetch(
      `${AI_ENGINE_URL}/api/v1/bots/${botId}/converse/${userId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BOTPRESS_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "text", text: message }),
      }
    );

    if (!response.ok) {
      console.error(
        `[AI Engine] Converse request failed with status: ${response.status}`
      );
      throw new AiEngineError("Failed to communicate with AI engine");
    }

    return await response.json();
  } catch (error) {
    console.error("[AI Engine] Converse request failed:", error);
    throw new AiEngineError("Service unavailable");
  }
}
