import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { messageQueue } from "@/lib/queue";
import {
  verifyWebhookSignature,
} from "@/lib/server/facebook-utils";
import { isChannelEnabled } from "@/lib/channel-config";

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
          // Process asynchronously. Since we are on a DigitalOcean Droplet (Node.js runtime),
          // we can safely fire-and-forget without @vercel/functions waitUntil.
          handleMessagingEvent(event).catch((err) =>
            logger.error(
              { error: err },
              "[Facebook Webhook] Async processing error",
            ),
          );
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

    // Idempotency check using Facebook message ID (mid)
    if (message?.mid) {
      const eventKey = `mid:${message.mid}`;
      try {
        await prisma.webhookLog.create({
          data: {
            type: "message",
            source: "facebook",
            event: eventKey,
            data: event as any,
          },
        });
      } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "code" in err && (err as any).code === "P2002") {
          // Already processed
          return;
        }
        throw err;
      }
    } else {
      // Log other events without strict de-duplication if mid is missing
      logWebhookEvent(event).catch((err) =>
        console.error("[Facebook Webhook] Failed to log event:", err),
      );
    }
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
 * Process a message and send a reply via background queue
 */
async function handleMessage(
  senderPsid: string | undefined,
  pageId: string | undefined,
  messageText: string,
) {
  if (!senderPsid || !pageId) {
    logger.warn("[Facebook Webhook] Missing sender or recipient ID");
    return;
  }

  await messageQueue.add("facebook-message", {
    type: "facebook",
    payload: { senderPsid, pageId, messageText },
  });
}

/**
 * Log webhook event to database for debugging
 */
async function logWebhookEvent(event: any) {
  try {
    let eventType = "unknown";
    if (event.postback) eventType = "postback";
    else if (event.delivery) eventType = "delivery";
    else if (event.read) eventType = "read";

    await prisma.webhookLog.create({
      data: {
        type: eventType,
        source: "facebook",
        event: null, // No unique constraint if event is null
        data: event as any,
      },
    });
  } catch (error) {
    // Silently fail - logging is non-critical
    logger.error({ error }, "[Facebook Webhook] Log error");
  }
}
