import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTenantSubscription } from "./subscription";

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
    // This indicates a problem with our database, not the AI engine.
    // However, from the client's perspective, the system is down.
    return { engine: "down", reason: "unreachable" };
  }
}

export const ConverseInputSchema = z
  .object({
    botId: z.string().min(1),
    tenantId: z.string().min(1),
    contact: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }),
    message: z.string().min(1),
  })
  .refine(
    (data) =>
      !!data.contact.name || !!data.contact.email || !!data.contact.phone,
    {
      message:
        "At least one contact identifier (name, email, or phone) must be provided",
    }
  );

type ConverseInput = z.infer<typeof ConverseInputSchema>;

async function logAiUsage(tenantId: string, botId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Normalize to the start of the day in UTC

  try {
    await prisma.usageLog.upsert({
      where: {
        tenantId_type_date_botId_channelId: {
          tenantId,
          type: "message",
          date: today,
          botId,
          channelId: "api", // Earmark API-based interactions
        },
      },
      create: {
        tenantId,
        botId,
        type: "message",
        count: 1,
        date: today,
        channelId: "api",
      },
      update: {
        count: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    console.error("[UsageLog] Failed to log AI usage:", error);
    // Non-fatal. We don't want to interrupt the conversation for a billing-related issue.
  }
}

async function upsertCrmData(
  botId: string,
  tenantId: string,
  contact: { name?: string; email?: string; phone?: string }
) {
  // 1. Find or create the Contact
  let dbContact = await prisma.contact.findFirst({
    where: {
      tenantId,
      OR: [{ email: contact.email }, { phone: contact.phone }].filter(
        (c) => Object.values(c)[0]
      ),
    },
  });

  if (!dbContact) {
    dbContact = await prisma.contact.create({
      data: {
        tenantId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      },
    });
  }

  // 2. Find or create the Conversation
  let conversation = await prisma.crmConversation.findFirst({
    where: {
      contactId: dbContact.id,
      botId,
    },
  });

  if (!conversation) {
    // Check plan limits before creating a new conversation
    const subscription = await getTenantSubscription(tenantId);
    const conversationCount = await prisma.crmConversation.count({
      where: {
        contact: {
          tenantId: tenantId,
        },
      },
    });

    if (
      subscription.plan.maxConversations > 0 &&
      conversationCount >= subscription.plan.maxConversations
    ) {
      throw new AiEngineError(
        "Conversation limit reached. Please upgrade your plan."
      );
    }

    conversation = await prisma.crmConversation.create({
      data: {
        contactId: dbContact.id,
        botId,
        channel: "api", // Earmark API-based conversations
      },
    });
  }

  return { contact: dbContact, conversation };
}

/**
 * Sends a message to a bot and returns the response, while also handling CRM and logging.
 * @param input The validated input data from the API.
 * @returns A promise that resolves to the bot's response.
 */
export async function converse(input: ConverseInput) {
  assertServerConfig();
  const { botId, tenantId, contact, message } = input;

  const { conversation } = await upsertCrmData(
    botId,
    tenantId,
    contact
  );
  const conversationId = conversation.id; // Use our internal ID for the AI engine session

  // Log the inbound message
  await prisma.crmMessage.create({
    data: {
      conversationId,
      direction: "inbound",
      content: message,
    },
  });

  try {
    const response = await fetch(
      `${AI_ENGINE_URL}/api/v1/bots/${botId}/converse/${conversationId}`,
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
      const errorDetails = await response.text();
      console.error(
        `[AI Engine] Converse request failed with status: ${response.status}`,
        errorDetails
      );
      await updateHealthStatus(false, {
        status: response.status,
        statusText: response.statusText,
        body: errorDetails,
      });
      throw new AiEngineError("Failed to communicate with AI engine");
    }

    const responseData = await response.json();
    await updateHealthStatus(true);
    await logAiUsage(tenantId, botId);

    // Log the outbound message(s)
    if (responseData.responses && Array.isArray(responseData.responses)) {
      for (const res of responseData.responses) {
        if (res.type === "text") {
          await prisma.crmMessage.create({
            data: {
              conversationId,
              direction: "outbound",
              content: res.text,
              source: "ai",
            },
          });
        }
      }
    }

    return responseData;
  } catch (error) {
    console.error("[AI Engine] Converse request failed:", error);
    await updateHealthStatus(false, {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (error instanceof AiEngineError) {
      throw error;
    }
    throw new AiEngineError("Service unavailable");
  }
}
