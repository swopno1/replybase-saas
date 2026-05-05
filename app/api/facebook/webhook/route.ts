import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import {
  sendFacebookSenderAction,
  sendTextMessage,
} from "@/lib/facebook-sender";
import {
  verifyWebhookSignature,
  getFacebookGraphUrl,
} from "@/lib/server/facebook-utils";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import { isChannelEnabled } from "@/lib/channel-config";
import { waitForFlowDurationMs } from "@/lib/flow-runtime-utils";

// GET: Webhook Verification
export async function GET(req: NextRequest) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    logger.warn("[Facebook Webchat] Channel is disabled");
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    logger.error("FACEBOOK_WEBHOOK_VERIFY_TOKEN not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (mode === "subscribe" && token === verifyToken) {
    // Log verification success
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).webhookLog?.create({
        data: {
          type: "verification",
          source: "facebook",
          event: "webhook_verify",
          data: { mode, success: true },
        },
      });
    } catch (logError) {
      logger.error({ error: logError }, "[Facebook Webhook] Failed to log verification");
    }

    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn("[Facebook Webhook] Verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Webhook Event Handler
export async function POST(req: NextRequest) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    logger.warn("[Facebook Webhook] Channel is disabled");
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  try {
    // Webhook signature is REQUIRED in all environments for Meta integration hardening
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

    if (!appSecret) {
      logger.error("[Facebook Webhook] FACEBOOK_CLIENT_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    if (!signature) {
      logger.error("[Facebook Webhook] Missing X-Hub-Signature-256 header");
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 401 },
      );
    }

    // Get raw body for signature verification
    const bodyText = await req.text();
    const isValid = verifyWebhookSignature(bodyText, signature, appSecret);

    if (!isValid) {
      logger.error("[Facebook Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // Parse the verified body
    const body = JSON.parse(bodyText);

    // Log webhook event to database (async, don't await to avoid blocking)
    logWebhookEvent(body).catch((err) =>
      logger.error("[Facebook Webhook] Failed to log event:", err),
    );

    // Process each entry in the webhook payload
    if (body.object === "page" && body.entry) {
      for (const entry of body.entry) {
        const messaging = entry.messaging;
        if (!messaging || !Array.isArray(messaging)) continue;

        for (const event of messaging) {
          // Process using waitUntil to ensure execution in serverless environments
          try {
            waitUntil(
              handleMessagingEvent(event).catch((err) =>
                logger.error(
                  { error: err },
                  "[Facebook Webhook] Async processing error",
                ),
              ),
            );
          } catch (e) {
            // Fallback if waitUntil is not available
            handleMessagingEvent(event).catch((err) =>
              logger.error(
                { error: err },
                "[Facebook Webhook] Async processing error (fallback)",
              ),
            );
          }
        }
      }
    }

    // Always return 200 OK to Facebook to prevent retries
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ error }, "[Facebook Webhook] Error processing event");
    // Still return 200 to prevent Facebook from retrying
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

interface FacebookMessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  message?: {
    mid?: string; // Facebook message ID
    text?: string;
    is_echo?: boolean;
    quick_reply?: {
      payload: string;
    };
  };
  delivery?: unknown;
  read?: unknown;
  postback?: {
    payload?: string;
    title?: string;
  };
}

/**
 * Handles a single messaging event from Facebook
 */
async function handleMessagingEvent(event: FacebookMessagingEvent) {
  try {
    // Skip delivery and read receipts, but handle postbacks and messages
    if (event.delivery || event.read) {
      return;
    }

    // Skip echoed messages
    if (event.message?.is_echo) {
      return;
    }

    const { sender, recipient, message, postback } = event;
    const senderPsid = sender?.id;
    const pageId = recipient?.id;

    // Handle postback events (like Get Started button)
    if (postback) {
      const messageText = postback.payload || "Hi";
      await handleMessage(senderPsid, pageId, messageText);
      return;
    }

    // Handle regular messages
    const messageText = message?.quick_reply?.payload || message?.text;

    if (!messageText) {
      // For MVP, we only handle text messages.
      return;
    }

    await handleMessage(senderPsid, pageId, messageText);
  } catch (error) {
    logger.error(
      { error },
      "[Facebook Webhook] Unhandled error in handleMessagingEvent",
    );
  }
}

/**
 * Process a message and send a reply
 */
async function handleMessage(
  senderPsid: string | undefined,
  pageId: string | undefined,
  messageText: string,
) {
  try {
    if (!senderPsid || !pageId) {
      logger.warn("[Facebook Webhook] Missing sender or recipient ID");
      return;
    }

    // 1. Find the page
    const facebookPage = await prisma.facebookPage.findUnique({
      where: { facebookId: pageId },
    });

    if (!facebookPage || !facebookPage.tenantId) {
      logger.warn(
        `[Facebook Webhook] Page ${pageId} not found or missing tenantId`,
      );
      return;
    }

    const { tenantId, accessToken } = facebookPage;

    // 2. Fetch user profile (optional — for contact display name)
    let userName: string | undefined;
    try {
      const profileUrl = getFacebookGraphUrl(senderPsid, accessToken, {
        fields: "first_name,last_name",
      });
      const profileResponse = await fetch(profileUrl);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const fullName =
          `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim();
        if (fullName) {
          userName = fullName;
        }
      }
    } catch {
      // Non-critical — contact name falls back to PSID
    }

    // 3. Find or create Contact
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        identities: { some: { type: "facebook_psid", value: senderPsid } },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          name: userName || senderPsid,
          identities: { create: { type: "facebook_psid", value: senderPsid } },
        },
      });
    } else if (userName && contact.name !== userName) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: userName },
      });
    }

    // 4. Find or create Conversation (requires botId for CRM linkage)
    let conversation: {
      id: string;
      botId: string | null;
      metadata: unknown;
      botPaused: boolean;
    } | null = null;
    if (facebookPage.botId) {
      conversation = await prisma.crmConversation.findFirst({
        where: { contactId: contact.id, facebookPageId: facebookPage.id },
      });
      if (!conversation) {
        conversation = await prisma.crmConversation.create({
          data: {
            tenantId,
            contactId: contact.id,
            channel: "facebook",
            botId: facebookPage.botId,
            facebookPageId: facebookPage.id,
          },
        });
      }
    }

    // 5. Log inbound message
    if (conversation) {
      await prisma.crmMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: "inbound",
          content: messageText,
          source: "human",
        },
      });
    }

    // 5b. Honour Bot Pause — if an agent has taken over, do not send automated replies
    if (conversation?.botPaused) {
      return;
    }

    // 6. Try Flow Builder first (works without AI/bot engine configured)
    try {
      const flowAssignment = await prisma.flowAssignment.findFirst({
        where: { pageId: facebookPage.id, isActive: true },
        select: { flowId: true },
      });

      const flowResult = await executeBotEntryFlowFirst({
        tenantId,
        contactId: contact.id,
        scopeKey: `facebook:${facebookPage.id}`,
        message: messageText,
        entryFlow: flowAssignment?.flowId ?? null,
        variables: { channel: "facebook", psid: senderPsid },
      });

      const flowResponses = flowResult?.responses ?? [];
      const hasFlowText = flowResponses.some(
        (r) => r.type === "text" && r.text,
      );

      if (hasFlowText) {
        // Dispatch all responses in sequence: typing indicators + messages
        for (const resp of flowResponses) {
          if (resp.type === "typing" && resp.durationMs > 0) {
            await sendFacebookSenderAction(
              accessToken,
              senderPsid,
              "typing_on",
            );
            await waitForFlowDurationMs(Math.min(resp.durationMs, 3000));
            await sendFacebookSenderAction(
              accessToken,
              senderPsid,
              "typing_off",
            );
          } else if (resp.type === "text" && resp.text) {
            await sendTextMessage(accessToken, senderPsid, resp.text);
            if (conversation) {
              await prisma.crmMessage
                .create({
                  data: {
                    tenantId,
                    conversationId: conversation.id,
                    direction: "outbound",
                    content: resp.text,
                    source: "flow",
                  },
                })
                .catch(() => {});
            }
          }
        }

        await recordMilestoneEvent(tenantId, "first-channel", {
          channelType: "facebook",
          pageId: facebookPage.id,
        });
        await recordMilestoneEvent(tenantId, "first-automated-reply", {
          channelType: "facebook",
          source: "flow",
        });
        return;
      }
    } catch (error) {
      logger.error({ error }, "[Facebook Webhook] Flow Engine Error");
      // Fall through to AI
    }

    // 7. AI fallback: if flow did not handle, use fallback AI
    try {
      if (facebookPage.botId && conversation) {
        // Fetch plan name for quota/context (default to "free" if missing)
        const subscription = await prisma.subscription.findUnique({
          where: { tenantId },
          select: { plan: { select: { name: true } } },
        });
        const plan = subscription?.plan?.name || "free";

        // Fetch last 10 messages for context
        const lastMessages = await prisma.crmMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { content: true, source: true },
        });
        // Build messages array for AI (user/assistant roles)
        const aiMessages: ModelMessage[] = lastMessages.reverse().map((msg) => ({
          role: msg.source === "human" ? "user" : "assistant",
          content: msg.content,
        }));
        aiMessages.push({ role: "user", content: messageText });

        // Dynamically import aiFallback to avoid circular deps
        const { aiFallback } = await import("@/lib/ai-fallback");
        const aiStream = await aiFallback({
          botId: facebookPage.botId,
          conversationId: conversation.id,
          messages: aiMessages,
          planName: plan,
        });

        // Use .text() to get the full AI response (streamText returns a StreamTextResult)
        const aiText =
          aiStream && "text" in aiStream
            ? await aiStream.text
            : String(aiStream ?? "");

        if (aiText.trim()) {
          await sendTextMessage(accessToken, senderPsid, aiText.trim());
          await prisma.crmMessage.create({
            data: {
              tenantId,
              conversationId: conversation.id,
              direction: "outbound",
              content: aiText.trim(),
              source: "ai",
            },
          });
          await recordMilestoneEvent(tenantId, "first-channel", {
            channelType: "facebook",
            pageId: facebookPage.id,
          });
          await recordMilestoneEvent(tenantId, "first-automated-reply", {
            channelType: "facebook",
            source: "ai",
          });
          return;
        }
      }
    } catch (aiError) {
      logger.error({ error: aiError }, "[Facebook Webhook] AI fallback error");
      // If AI fails, fall through to static message
    }

    // 8. Static fallback if all else fails
    const fallbackMessage = "All of our agents are currently busy or offline. Please leave your email address, and we'll get back to you as soon as possible.";
    await sendTextMessage(
      accessToken,
      senderPsid,
      fallbackMessage,
    );
    if (conversation) {
      await prisma.crmMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: "outbound",
          content: fallbackMessage,
          source: "ai",
        },
      });
    }
    await recordMilestoneEvent(tenantId, "first-channel", {
      channelType: "facebook",
      pageId: facebookPage.id,
    });
    await recordMilestoneEvent(tenantId, "first-automated-reply", {
      channelType: "facebook",
      source: "ai",
    });
  } catch (error) {
    logger.error({ error }, "[Facebook Webhook] Error in handleMessage");
  }
}

/**
 * Log webhook event to database for debugging
 * Note: This will be available after running: npx prisma migrate dev
 */
async function logWebhookEvent(body: Record<string, unknown>) {
  try {
    const entry = (body?.entry as unknown[])?.[0] as Record<string, unknown>;
    const messaging = (entry?.messaging as unknown[])?.[0] as Record<
      string,
      unknown
    >;

    let eventType = "unknown";
    let eventData: Record<string, unknown> = { raw: body };

    if (messaging?.message) {
      eventType = "message";
      const msg = messaging.message as Record<string, unknown>;
      const sender = messaging.sender as Record<string, unknown>;
      eventData = {
        sender: sender?.id,
        text: msg?.text,
        hasAttachments: Boolean(msg?.attachments),
      };
    } else if (messaging?.postback) {
      eventType = "postback";
      const postback = messaging.postback as Record<string, unknown>;
      const sender = messaging.sender as Record<string, unknown>;
      eventData = {
        sender: sender?.id,
        payload: postback?.payload,
        title: postback?.title,
      };
    } else if (messaging?.delivery) {
      eventType = "delivery";
    } else if (messaging?.read) {
      eventType = "read";
    }

    // Only create if webhookLog model exists (after migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((prisma as any).webhookLog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).webhookLog.create({
        data: {
          type: eventType,
          source: "facebook",
          event: body?.object || "page",
          data: eventData,
        },
      });
    }
  } catch (error) {
    // Silently fail - logging is non-critical
    logger.error({ error }, "[Facebook Webhook] Log error");
  }
}
