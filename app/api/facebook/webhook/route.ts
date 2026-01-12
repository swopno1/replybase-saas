import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/session-resolver";
import { converse } from "@/lib/ai-engine";
import { sendTextMessage } from "@/lib/facebook-sender";
import { verifyWebhookSignature } from "@/lib/facebook-utils";

// GET: Webhook Verification
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("FACEBOOK_WEBHOOK_VERIFY_TOKEN not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Facebook Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Facebook Webhook] Verification failed");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Webhook Event Handler
export async function POST(req: NextRequest) {
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
          { status: 403 }
        );
      }

      // Parse the verified body
      const body = JSON.parse(bodyText);
      console.log("[Facebook Webhook] Received verified event");

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
        "[Facebook Webhook] Signature verification skipped (signature or secret not available)"
      );
      const body = await req.json();
      console.log(
        "[Facebook Webhook] Received event:",
        JSON.stringify(body, null, 2)
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
  };
  delivery?: unknown;
  read?: unknown;
  postback?: unknown;
}

/**
 * Handles a single messaging event from Facebook
 */
async function handleMessagingEvent(event: FacebookMessagingEvent) {
  try {
    // Skip delivery receipts
    if (event.delivery) {
      console.log("[Facebook Webhook] Skipping delivery receipt");
      return;
    }

    // Skip read receipts
    if (event.read) {
      console.log("[Facebook Webhook] Skipping read receipt");
      return;
    }

    // Skip postbacks (button clicks, etc.)
    if (event.postback) {
      console.log("[Facebook Webhook] Skipping postback event");
      return;
    }

    // Only process message events
    if (!event.message) {
      console.log("[Facebook Webhook] Skipping non-message event");
      return;
    }

    // Ignore echoes (messages sent by the page)
    if (event.message.is_echo) {
      console.log("[Facebook Webhook] Ignoring echo");
      return;
    }

    // Extract message data
    const senderPsid = event.sender?.id;
    const pageId = event.recipient?.id;
    const messageText = event.message?.text;

    // Skip messages without text (attachments, quick replies, etc.) - MVP only handles text
    if (!messageText) {
      console.log(
        "[Facebook Webhook] Skipping non-text message (attachments/quick replies not supported in MVP)"
      );
      return;
    }

    if (!senderPsid || !pageId) {
      console.warn("[Facebook Webhook] Missing required fields:", {
        senderPsid,
        pageId,
      });
      return;
    }

    console.log(
      `[Facebook Webhook] Processing message from PSID ${senderPsid} to Page ${pageId}`
    );

    // Look up the Facebook Page configuration
    const facebookPage = await prisma.facebookPage.findUnique({
      where: { facebookId: pageId },
      select: {
        id: true,
        facebookId: true,
        accessToken: true,
        botId: true,
        engineConnected: true,
      },
    });

    if (!facebookPage) {
      console.warn(`[Facebook Webhook] Page ${pageId} not found in database`);
      return;
    }

    if (!facebookPage.engineConnected || !facebookPage.botId) {
      console.warn(`[Facebook Webhook] Page ${pageId} not connected to engine`);
      return;
    }

    // Resolve or create conversation session
    const session = await resolveSession(pageId, senderPsid);
    console.log(
      `[Facebook Webhook] Session resolved: ${session.sessionId} (new: ${session.isNew})`
    );

    // Log inbound message
    await prisma.messageLog.create({
      data: {
        conversationId: session.conversationId,
        direction: "inbound",
        messageId: event.message?.mid || `inbound-${Date.now()}`, // Use Facebook's message ID or fallback
        content: messageText,
        status: "success",
      },
    });

    // Send message to AI engine
    let replyText: string;
    let logStatus: "success" | "error" = "success";
    let errorDetails: string | null = null;

    try {
      console.log(
        `[Facebook Webhook] Sending to AI engine bot ${facebookPage.botId}`
      );
      const engineResponse = await converse(
        facebookPage.botId,
        session.sessionId,
        messageText
      );

      // Extract the text from the first 'text' type response
      const textResponse = engineResponse.responses?.find(
        (r: { type: string; text: string }) => r.type === "text"
      );

      if (textResponse?.text) {
        replyText = textResponse.text;
        console.log(`[Facebook Webhook] Engine replied: ${replyText}`);
      } else {
        throw new Error("No text response from engine");
      }
    } catch (error) {
      // Fallback message
      replyText =
        "Sorry, I'm having trouble responding right now. Please try again later.";
      logStatus = "error";
      errorDetails =
        error instanceof Error ? error.message : "Unknown engine error";
      console.error(`[Facebook Webhook] Engine error: ${errorDetails}`);
    }

    // Send reply to Facebook
    const sendResult = await sendTextMessage(
      facebookPage.accessToken,
      senderPsid,
      replyText
    );

    if (sendResult.success) {
      console.log(
        `[Facebook Webhook] Reply sent successfully (Message ID: ${sendResult.messageId})`
      );

      // Log outbound message
      await prisma.messageLog.create({
        data: {
          conversationId: session.conversationId,
          direction: "outbound",
          messageId: sendResult.messageId || `outbound-${Date.now()}`, // Use the sent message ID or fallback
          content: replyText,
          status: logStatus,
          errorDetails,
        },
      });
    } else {
      console.error(
        `[Facebook Webhook] Failed to send reply: ${sendResult.error}`
      );

      // Log failed outbound message
      await prisma.messageLog.create({
        data: {
          conversationId: session.conversationId,
          direction: "outbound",
          messageId: `failed-${Date.now()}`, // Fallback for failed sends
          content: replyText,
          status: "error",
          errorDetails: sendResult.error || "Unknown send error",
        },
      });
    }
  } catch (error) {
    console.error("[Facebook Webhook] Error handling messaging event:", error);
  }
}
