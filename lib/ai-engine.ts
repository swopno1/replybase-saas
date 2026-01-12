import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL;
const BOTPRESS_SERVICE_TOKEN = process.env.BOTPRESS_SERVICE_TOKEN;
const AI_ENGINE_HEALTH_THRESHOLD_MINUTES = 5;

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

async function updateHealthStatus(isHealthy: boolean, details?: object) {
  try {
    await prisma.systemHealth.upsert({
      where: { system: "ai-engine" },
      create: {
        system: "ai-engine",
        isHealthy,
        details: details || Prisma.JsonNull,
      },
      update: {
        isHealthy,
        details: details || Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error("[SystemHealth] Failed to update AI engine health:", error);
  }
}

/**
 * Checks the health of the AI engine based on the last successful interaction.
 * This is a contract-based health check, not an infrastructure-based one.
 * We do not poll Botpress admin or engine endpoints, as they are internal
 * and not guaranteed to be stable or publicly available.
 * @returns A promise that resolves to an object indicating the engine status.
 */
export async function checkHealth() {
  assertServerConfig();
  try {
    const healthStatus = await prisma.systemHealth.findUnique({
      where: { system: "ai-engine" },
    });

    if (!healthStatus) {
      return { engine: "unknown", provider: "ai-engine" };
    }

    // If the last interaction failed, it's down. No time-check needed.
    if (!healthStatus.isHealthy) {
      return {
        engine: "down",
        reason: "unhealthy",
        details: healthStatus.details,
      };
    }

    // If the last interaction succeeded, check if it's recent enough.
    const minutesSinceLastCheck =
      (new Date().getTime() - new Date(healthStatus.lastChecked).getTime()) /
      (1000 * 60);
    if (minutesSinceLastCheck > AI_ENGINE_HEALTH_THRESHOLD_MINUTES) {
      return {
        engine: "unknown",
        reason: `No successful interaction within the last ${AI_ENGINE_HEALTH_THRESHOLD_MINUTES} minutes`,
      };
    }

    // It's healthy and the status is recent.
    return { engine: "ok", provider: "ai-engine" };
  } catch (error) {
    console.error("[AI Engine] Health check failed:", error);
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
      await updateHealthStatus(false, {
        status: response.status,
        statusText: response.statusText,
      });
      throw new AiEngineError("Failed to communicate with AI engine");
    }

    await updateHealthStatus(true);
    return await response.json();
  } catch (error) {
    console.error("[AI Engine] Converse request failed:", error);
    await updateHealthStatus(false, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new AiEngineError("Service unavailable");
  }
}
