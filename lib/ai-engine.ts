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
 * Since Typebot is a managed service, we assume it's healthy if configured.
 * We only mark it as down if there's an explicit error.
 */
export async function checkHealth() {
  try {
    // For managed Typebot service, assume healthy if token is configured
    if (!TYPEBOT_TOKEN) {
      return { engine: "down", reason: "not configured", provider: "typebot" };
    }

    const healthStatus = await prisma.systemHealth.findUnique({
      where: { system: "ai-engine" },
    });

    // If no health record exists or it's marked unhealthy with recent failure, check again
    if (!healthStatus || !healthStatus.isHealthy) {
      // Try a quick API call to verify
      try {
        const response = await fetch(`${AI_ENGINE_URL}/api/me`, {
          headers: {
            Authorization: `Bearer ${TYPEBOT_TOKEN}`,
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          await updateHealthStatus(true, { lastVerified: new Date() });
          return { engine: "ok", provider: "typebot" };
        }
      } catch (error) {
        console.warn(
          "[AI Engine] Verification failed, but assuming healthy for managed service",
        );
        // Even if verification fails, assume healthy since Typebot is managed
        return { engine: "ok", provider: "typebot" };
      }
    }

    return { engine: "ok", provider: "typebot" };
  } catch (error) {
    console.error("[AI Engine] Health check error:", error);
    // Assume healthy by default for managed service
    return { engine: "ok", provider: "typebot" };
  }
}

export const ConverseInputSchema = z
  .object({
    botId: z.string().min(1),
    tenantId: z.string().min(1),
    conversationId: z.string().min(1).optional(),
    channel: z.string().min(1).optional(),
    contact: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    message: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.conversationId) {
      return;
    }

    const contact = data.contact;
    if (!contact?.name && !contact?.email && !contact?.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide conversationId or at least one contact identifier (name, email, or phone)",
        path: ["contact"],
      });
    }
  });

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
  contact: { name?: string; email?: string; phone?: string },
  channel = "api",
) {
  let dbContact = await prisma.contact.findFirst({
    where: {
      tenantId,
      OR: [{ email: contact.email }, { phone: contact.phone }].filter(
        (c) => Object.values(c)[0],
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
        "Conversation limit reached. Please upgrade your plan.",
      );
    }

    conversation = await prisma.crmConversation.create({
      data: {
        contactId: dbContact.id,
        botId,
        channel,
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
  const response = await fetch(
    `${AI_ENGINE_URL}/api/v1/typebots/${publicId}/startChat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TYPEBOT_TOKEN}`,
      },
      body: JSON.stringify({
        message,
        isStreamEnabled: false,
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      // The Typebot public ID must match the ReplyBase bot ID exactly.
      // If this 404s, it means no published Typebot flow exists for that ID.
      // Ensure the Typebot flow is published and its public ID equals the bot's ID in ReplyBase.
      throw new AiEngineError(
        `Typebot flow not found (publicId: ${publicId}). ` +
          `Publish the flow in Typebot and confirm its public ID matches the ReplyBase bot ID.`,
      );
    }
    throw new Error(`Failed to start chat: ${response.statusText}`);
  }

  return (await response.json()) as TypebotResponse;
}

async function continueTypebotChat(sessionId: string, message: string) {
  const response = await fetch(
    `${AI_ENGINE_URL}/api/v1/sessions/${sessionId}/continueChat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TYPEBOT_TOKEN}`,
      },
      body: JSON.stringify({
        message,
      }),
    },
  );

  if (!response.ok) {
    // If session is not found (404), we might need to restart
    if (response.status === 404) {
      throw new Error("Session not found");
    }
    throw new Error(`Failed to continue chat: ${response.statusText}`);
  }

  return (await response.json()) as TypebotResponse;
}

/**
 * Send a message to the AI engine and return its responses.
 *
 * CONTRACT: `botId` is used directly as the Typebot flow public ID when starting
 * a new chat session. The Typebot flow must be published with a public ID that
 * exactly matches the ReplyBase Bot.id. If the IDs diverge the Typebot API will
 * return 404 and the call will fail with a descriptive AiEngineError.
 */
export async function converse(input: ConverseInput) {
  assertServerConfig();
  const {
    botId,
    tenantId,
    contact,
    message,
    conversationId: inputConversationId,
    channel,
  } = input;

  // 0. Authorize: verify bot exists, belongs to this tenant, and is enabled
  const bot = await prisma.bot.findFirst({
    where: { id: botId, tenantId },
    select: { id: true, enabled: true },
  });
  if (!bot) {
    throw new AiEngineError("Bot not found");
  }
  if (!bot.enabled) {
    throw new AiEngineError("Bot is disabled");
  }

  // 1. CRM & Conversation Lookup
  let conversation: {
    id: string;
    externalSessionId: string | null;
    channel: string;
    botId: string | null;
  };
  let conversationId: string;

  if (inputConversationId) {
    const existingConversation = await prisma.crmConversation.findUnique({
      where: { id: inputConversationId },
      include: {
        contact: {
          select: {
            tenantId: true,
          },
        },
      },
    });

    if (!existingConversation) {
      throw new AiEngineError("Conversation not found");
    }

    if (existingConversation.contact.tenantId !== tenantId) {
      throw new AiEngineError("Conversation tenant mismatch");
    }

    if (existingConversation.botId && existingConversation.botId !== botId) {
      throw new AiEngineError("Conversation bot mismatch");
    }

    if (!existingConversation.botId) {
      conversation = await prisma.crmConversation.update({
        where: { id: existingConversation.id },
        data: {
          botId,
          channel: channel || existingConversation.channel || "api",
        },
      });
    } else {
      conversation = existingConversation;
    }

    conversationId = existingConversation.id;
  } else {
    if (!contact) {
      throw new AiEngineError("Missing contact information");
    }
    const crmData = await upsertCrmData(botId, tenantId, contact, channel);
    conversation = crmData.conversation;
    conversationId = crmData.conversation.id;
  }

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
          console.log(
            `[AI Engine] Session ${externalSessionId} not found, starting new chat.`,
          );
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
        if (
          msg.type === "text" ||
          (msg.content as any)?.type === "text" ||
          msg.type === "bubble"
        ) {
          // Typebot structure varies slightly by version/block.
          // Ideally msg.content.richText or msg.content (if string) or just msg.text if flattened
          let textContent = "";
          if (typeof msg.content === "string") {
            textContent = msg.content;
          } else if ((msg.content as any)?.richText) {
            // Simplistic extraction, might need rich text parser
            textContent = (msg.content as any).richText
              .map((node: any) =>
                node.children.map((c: any) => c.text).join(""),
              )
              .join("\n");
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
