import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTenantSubscription } from "./subscription";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || "https://typebot.io";
const TYPEBOT_TOKEN = process.env.TYPEBOT_TOKEN;
const AI_ENGINE_HEALTH_THRESHOLD_MINUTES = 5;

export class AiEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiEngineError";
  }
}

function assertServerConfig() {
  if (!TYPEBOT_TOKEN) {
    console.error("[AI Engine] TYPEBOT_TOKEN is not configured.");
    throw new AiEngineError("Service unavailable: Missing configuration");
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
 * Checks the health of the AI engine (Typebot).
 * Uses Typebot's API (e.g., getting a simple bot or user info) or relies on recent interaction success.
 */
export async function checkHealth() {
  try {
    const healthStatus = await prisma.systemHealth.findUnique({
      where: { system: "ai-engine" },
    });

    if (!healthStatus) {
      return { engine: "unknown", provider: "typebot" };
    }

    if (!healthStatus.isHealthy) {
      return {
        engine: "down",
        reason: "unhealthy",
        details: healthStatus.details,
      };
    }

    const minutesSinceLastCheck =
      (new Date().getTime() - new Date(healthStatus.lastChecked).getTime()) /
      (1000 * 60);
    if (minutesSinceLastCheck > AI_ENGINE_HEALTH_THRESHOLD_MINUTES) {
      return {
        engine: "unknown",
        reason: `No successful interaction within the last ${AI_ENGINE_HEALTH_THRESHOLD_MINUTES} minutes`,
      };
    }

    return { engine: "ok", provider: "typebot" };
  } catch (error) {
    console.error("[AI Engine] Health check failed:", error);
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
  today.setUTCHours(0, 0, 0, 0);

  try {
    await prisma.usageLog.upsert({
      where: {
        tenantId_type_date_botId_channelId: {
          tenantId,
          type: "message",
          date: today,
          botId,
          channelId: "api",
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
  }
}

async function upsertCrmData(
  botId: string,
  tenantId: string,
  contact: { name?: string; email?: string; phone?: string }
) {
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

  let conversation = await prisma.crmConversation.findFirst({
    where: {
      contactId: dbContact.id,
      botId,
    },
  });

  if (!conversation) {
    const subscription = await getTenantSubscription(tenantId);
    const conversationCount = await prisma.crmConversation.count({
      where: {
        contact: {
          tenantId: tenantId,
        },
      },
    });

    if (
      subscription.maxConversations > 0 &&
      conversationCount >= subscription.maxConversations
    ) {
      throw new AiEngineError(
        "Conversation limit reached. Please upgrade your plan."
      );
    }

    conversation = await prisma.crmConversation.create({
      data: {
        contactId: dbContact.id,
        botId,
        channel: "api",
      },
    });
  }

  return { contact: dbContact, conversation };
}

// Typebot API Response Types (Simplified)
interface TypebotResponse {
  sessionId: string;
  messages: Array<{
    id: string;
    type: string;
    content: unknown; // can be text, image, etc.
    text?: string; // flattened for text messages
  }>;
  input?: unknown;
}

async function startTypebotChat(publicId: string, message: string) {
  const response = await fetch(`${AI_ENGINE_URL}/api/v1/typebots/${publicId}/startChat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TYPEBOT_TOKEN}`,
    },
    body: JSON.stringify({
      message,
      isStreamEnabled: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start chat: ${response.statusText}`);
  }

  return (await response.json()) as TypebotResponse;
}

async function continueTypebotChat(sessionId: string, message: string) {
  const response = await fetch(`${AI_ENGINE_URL}/api/v1/sessions/${sessionId}/continueChat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TYPEBOT_TOKEN}`,
    },
    body: JSON.stringify({
      message,
    }),
  });

  if (!response.ok) {
    // If session is not found (404), we might need to restart
    if (response.status === 404) {
      throw new Error("Session not found");
    }
    throw new Error(`Failed to continue chat: ${response.statusText}`);
  }

  return (await response.json()) as TypebotResponse;
}

export async function converse(input: ConverseInput) {
  assertServerConfig();
  const { botId, tenantId, contact, message } = input;

  // 1. CRM & Conversation Lookup
  const { conversation } = await upsertCrmData(botId, tenantId, contact);
  const conversationId = conversation.id;

  // Log inbound
  await prisma.crmMessage.create({
    data: {
      conversationId,
      direction: "inbound",
      content: message,
    },
  });

  try {
    let typebotResponse: TypebotResponse;
    let externalSessionId = conversation.externalSessionId;

    // 2. Chat Logic: Continue or Start
    if (externalSessionId) {
      try {
        typebotResponse = await continueTypebotChat(externalSessionId, message);
      } catch (error: any) {
        if (error.message === "Session not found") {
          // Session expired or lost, start new
          console.log(`[AI Engine] Session ${externalSessionId} not found, starting new chat.`);
          typebotResponse = await startTypebotChat(botId, message);
          externalSessionId = typebotResponse.sessionId;
          // Update DB with new session
          await prisma.crmConversation.update({
            where: { id: conversationId },
            data: { externalSessionId },
          });
        } else {
          throw error;
        }
      }
    } else {
      // No session yet, start new
      typebotResponse = await startTypebotChat(botId, message);
      externalSessionId = typebotResponse.sessionId;
      await prisma.crmConversation.update({
        where: { id: conversationId },
        data: { externalSessionId },
      });
    }

    await updateHealthStatus(true);
    await logAiUsage(tenantId, botId);

    // 3. Process Responses
    const responses: any[] = [];
    if (typebotResponse.messages && Array.isArray(typebotResponse.messages)) {
      for (const msg of typebotResponse.messages) {
        // Handle different message types. For now, we focus on text (bubble)
        if (msg.type === "text" || (msg.content as any)?.type === "text" || msg.type === "bubble") {
          // Typebot structure varies slightly by version/block. 
          // Ideally msg.content.richText or msg.content (if string) or just msg.text if flattened
          let textContent = "";
          if (typeof msg.content === 'string') {
            textContent = msg.content;
          } else if ((msg.content as any)?.richText) {
            // Simplistic extraction, might need rich text parser
            textContent = (msg.content as any).richText.map((node: any) => node.children.map((c: any) => c.text).join('')).join('\n');
          } else if ((msg as any).text) {
            textContent = (msg as any).text; // Some API versions flat return text
          }

          // If we found text, log it
          if (textContent) {
            responses.push({ type: "text", text: textContent });
            await prisma.crmMessage.create({
              data: {
                conversationId,
                direction: "outbound",
                content: textContent,
                source: "ai",
              },
            });
          }
        }
      }
    }

    // Return in a standard format expected by callers
    return {
      responses,
      sessionId: externalSessionId,
    };

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
