import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// AI fallback removed April 2026
import {
  sendFacebookSenderAction,
  sendTextMessage,
} from "@/lib/facebook-sender";
import { verifyWebhookSignature } from "@/lib/facebook-utils";
import {
  processDefaultBotFlow,
  shouldUseDefaultFlow,
} from "@/lib/default-bot-flow";
import { OnboardingFlowHandler } from "@/lib/onboarding-flow-handler";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import { isChannelEnabled } from "@/lib/channel-config";
import { waitForFlowDurationMs } from "@/lib/flow-runtime-utils";

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

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("FACEBOOK_WEBHOOK_VERIFY_TOKEN not configured");
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
      const body = JSON.parse(bodyText);

      // Log webhook event to database (async, don't await to avoid blocking)
      logWebhookEvent(body).catch((err) =>
        console.error("[Facebook Webhook] Failed to log event:", err),
      );

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

      // Always return 200 OK to Facebook to prevent retries
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      // If signature verification is not available, still process (for development/testing)
      // In production, signature verification should be required
      console.warn(
        "[Facebook Webhook] Signature verification skipped (signature or secret not available)",
      );
      const body = await req.json();

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

    // 1. Find the page
    const facebookPage = await prisma.facebookPage.findUnique({
      where: { facebookId: pageId },
    });

    if (!facebookPage || !facebookPage.tenantId) {
      console.warn(
        `[Facebook Webhook] Page ${pageId} not found or missing tenantId`,
      );
      return;
    }

    const { tenantId, accessToken } = facebookPage;

    // 2. Fetch user profile (optional — for contact display name)
    let userName: string | undefined;
    try {
      const profileResponse = await fetch(
        `https://graph.facebook.com/${senderPsid}?fields=first_name,last_name&access_token=${accessToken}`,
      );
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
      console.error("[Facebook Webhook] Flow Engine Error:", error);
      // Fall through to AI
    }

    // 7. AI / default-flow fallback removed. Static message only.
    await sendTextMessage(
      accessToken,
      senderPsid,
      "Our AI Agent is under development! We'll be up again soon.",
    );
    if (conversation) {
      await prisma.crmMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          content: "Our AI Agent is under development! We'll be up again soon.",
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
