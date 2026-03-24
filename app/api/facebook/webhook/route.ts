import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { converse } from "@/lib/ai-engine";
import { sendTextMessage } from "@/lib/facebook-sender";
import { verifyWebhookSignature } from "@/lib/facebook-utils";
import {
  processDefaultBotFlow,
  shouldUseDefaultFlow,
} from "@/lib/default-bot-flow";
import { OnboardingFlowHandler } from "@/lib/onboarding-flow-handler";
import { FlowExecutionEngine } from "@/lib/flow-execution-engine";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import { isChannelEnabled } from "@/lib/channel-config";

// GET: Webhook Verification
export async function GET(req: NextRequest) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    console.warn("[Facebook Webhook] Channel is disabled");
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[Facebook Webhook] Verification request", {
    mode,
    hasToken: Boolean(token),
    hasChallenge: Boolean(challenge),
  });

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("FACEBOOK_WEBHOOK_VERIFY_TOKEN not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Facebook Webhook] Verification successful");

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
      console.error("[Facebook Webhook] Failed to log verification:", logError);
    }

    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Facebook Webhook] Verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Webhook Event Handler
export async function POST(req: NextRequest) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    console.warn("[Facebook Webhook] Channel is disabled");
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  try {
    // Verify webhook signature if provided (Facebook sends X-Hub-Signature-256)
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

    console.log("[Facebook Webhook] Incoming webhook", {
      hasSignature: Boolean(signature),
      contentType: req.headers.get("content-type"),
    });

    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && (!signature || !appSecret)) {
      console.error(
        "[Facebook Webhook] Missing signature or app secret in production",
      );
      return NextResponse.json(
        { error: "Signature verification required" },
        { status: 401 },
      );
    }

    if (signature && appSecret) {
      // Get raw body for signature verification
      const bodyText = await req.text();
      const isValid = verifyWebhookSignature(bodyText, signature, appSecret);

      if (!isValid) {
        console.error("[Facebook Webhook] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 },
        );
      }

      // Parse the verified body
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch (parseError) {
        console.error("[Facebook Webhook] Invalid JSON payload", parseError);
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      if (typeof body !== "object" || body === null) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const parsedBody = body as {
        object?: string;
        entry?: Array<{ messaging?: unknown }>;
      };

      console.log("[Facebook Webhook] Received verified event", {
        object: parsedBody.object,
        entryCount: Array.isArray(parsedBody.entry)
          ? (parsedBody.entry.length ?? 0)
          : 0,
      });

      // Log webhook event to database (async, don't await to avoid blocking)
      logWebhookEvent(body as Record<string, unknown>).catch((err) =>
        console.error("[Facebook Webhook] Failed to log event:", err),
      );

      if (parsedBody.object === "page" && parsedBody.entry) {
        for (const entry of parsedBody.entry) {
          const messaging = entry.messaging;
          if (!messaging || !Array.isArray(messaging)) continue;

          for (const event of messaging) {
            await handleMessagingEvent(event);
          }
        }
      }

      // Always return 200 OK to Facebook to prevent retries
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      // If signature verification is not available, still process (for development/testing)
      // In production, signature verification should be required
      console.warn(
        "[Facebook Webhook] Signature verification skipped (signature or secret not available)",
      );
      const body = await req.json();
      console.log("[Facebook Webhook] Received event summary:", {
        object: body?.object,
        entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
      });

      // Process each entry in the webhook payload
      if (body.object === "page" && body.entry) {
        for (const entry of body.entry) {
          const messaging = entry.messaging;
          if (!messaging || !Array.isArray(messaging)) continue;

          for (const event of messaging) {
            await handleMessagingEvent(event);
          }
        }
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }
  } catch (error) {
    console.error("[Facebook Webhook] Error processing event:", error);
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
    console.error(
      "[Facebook Webhook] Unhandled error in handleMessagingEvent:",
      error,
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
      console.warn("[Facebook Webhook] Missing sender or recipient ID");
      return;
    }

    // 1. Find the page and tenant
    const facebookPage = await prisma.facebookPage.findUnique({
      where: { facebookId: pageId },
    });

    if (!facebookPage) {
      console.warn(`[Facebook Webhook] Page ${pageId} not found`);
      return;
    }

    // 1.5. Check for active Flow Builder flow assignment FIRST
    // (Flow Builder doesn't require AI engine or bot to be configured)
    try {
      const flowResult = await FlowExecutionEngine.executeFlow({
        userId: senderPsid,
        pageId: facebookPage.id,
        message: messageText,
      });

      if (flowResult.success) {
        console.log("[Facebook Webhook] Flow executed successfully");
        return; // Flow engine handles all messaging
      } else if (flowResult.reason !== "no_active_flow") {
        console.error("[Facebook Webhook] Flow execution error:", flowResult);
        // Fall through to regular bot flow
      }
    } catch (error) {
      console.error("[Facebook Webhook] Flow Engine Error:", error);
      // Fall through to regular bot flow
    }

    // 2. Check if AI engine is configured (only needed for AI responses)
    if (
      !facebookPage.engineConnected ||
      !facebookPage.botId ||
      !facebookPage.tenantId
    ) {
      console.warn(
        `[Facebook Webhook] Page ${pageId} is not configured for AI.`,
      );
      return;
    }

    const { tenantId, botId, accessToken } = facebookPage;

    // 2. Fetch user profile from Facebook to get their name
    let userName: string | undefined;
    try {
      const userProfileUrl = `https://graph.facebook.com/${senderPsid}?fields=first_name,last_name&access_token=${accessToken}`;
      const profileResponse = await fetch(userProfileUrl);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        userName =
          `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim();
      }
    } catch (error) {
      console.warn("[Facebook Webhook] Could not fetch user profile:", error);
    }

    // 3. Find or create Contact and Conversation
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: tenantId,
        identities: { some: { type: "facebook_psid", value: senderPsid } },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: tenantId,
          name: userName || senderPsid, // Fallback to PSID if name fetch fails
          identities: {
            create: { type: "facebook_psid", value: senderPsid },
          },
        },
      });
    } else if (userName && contact.name !== userName) {
      // Update contact name if it has changed
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: userName },
      });
    }

    let conversation = await prisma.crmConversation.findFirst({
      where: { contactId: contact.id, facebookPageId: facebookPage.id },
    });

    if (!conversation) {
      conversation = await prisma.crmConversation.create({
        data: {
          contactId: contact.id,
          channel: "facebook",
          botId: botId,
          facebookPageId: facebookPage.id, // Correctly link the conversation to the page
        },
      });
    }

    // 4. Log inbound message to CRM
    await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        content: messageText,
        source: "human",
      },
    });

    // 5. Check if this is an onboarding conversation (new user without tenant)
    const isNewUser = !contact.tenantId || contact.tenantId === tenantId;
    const hasActiveOnboarding = await prisma.onboardingSession.findFirst({
      where: {
        contactId: contact.id,
        facebookPageId: facebookPage.id,
        status: "IN_PROGRESS",
      },
    });

    // If this is a "Get Started" message or user has active onboarding, use onboarding flow
    const isGetStarted =
      messageText.toLowerCase().includes("get started") ||
      messageText.toLowerCase().includes("hi") ||
      messageText.toLowerCase().includes("hello");

    if ((isNewUser && isGetStarted) || hasActiveOnboarding) {
      try {
        await OnboardingFlowHandler.handleMessage(
          facebookPage.id,
          senderPsid,
          messageText,
          conversation.id,
          contact.id,
          accessToken,
        );
        return; // Onboarding flow handles messaging
      } catch (error) {
        console.error("[Facebook Webhook] Onboarding Flow Error:", error);
        // Fall through to regular bot flow
      }
    }

    // 6. Determine bot flow and generate response for existing users
    let replyText: string;

    // Check if we should use default bot flow or AI engine
    const useDefaultFlow = shouldUseDefaultFlow(conversation);

    if (useDefaultFlow) {
      // Use default lead generation flow
      try {
        replyText = await processDefaultBotFlow(
          conversation.id,
          contact.id,
          tenantId,
          messageText,
        );
      } catch (error) {
        console.error("[Facebook Webhook] Default Flow Error:", error);
        replyText =
          "I'm having trouble processing your request. Our team will get back to you soon!";
      }
    } else {
      // Use AI Engine for custom bot
      try {
        const engineResponse = await converse({
          botId,
          tenantId,
          contact: {
            name: userName || senderPsid,
          },
          message: messageText,
        });

        type TextResponse = { type: "text"; text: string };
        const textResponse = engineResponse.responses?.find(
          (r: TextResponse) => r.type === "text",
        );
        replyText = textResponse?.text;

        if (!replyText) {
          throw new Error("No text response from engine");
        }
      } catch (error) {
        console.error("[Facebook Webhook] AI Engine Error:", error);
        replyText = "Sorry, I'm having trouble responding right now.";
      }
    }

    // 6. Send reply to Facebook
    await sendTextMessage(accessToken, senderPsid, replyText);

    // 7. Log outbound message to CRM
    await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "outbound",
        content: replyText,
        source: "ai",
      },
    });

    // 8. Record milestone events for onboarding tracking
    await recordMilestoneEvent(tenantId, "first-channel", {
      channelType: "facebook",
      pageId: facebookPage.id,
    });
    await recordMilestoneEvent(tenantId, "first-automated-reply", {
      channelType: "facebook",
      source: "flow",
    });
  } catch (error) {
    console.error("[Facebook Webhook] Error in handleMessage:", error);
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
    console.error("[Facebook Webhook] Log error:", error);
  }
}
