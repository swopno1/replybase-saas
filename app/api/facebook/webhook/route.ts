import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { messageQueue } from "@/lib/queue";
import {
  verifyWebhookSignature,
} from "@/lib/server/facebook-utils";
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
    // Webhook signature is REQUIRED in all environments for Meta integration hardening
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

    if (!appSecret) {
      console.error("[Facebook Webhook] FACEBOOK_CLIENT_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    if (!signature) {
      console.error("[Facebook Webhook] Missing X-Hub-Signature-256 header");
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 401 },
      );
    }

    // Get raw body for signature verification
    const bodyText = await req.text();
    const isValid = verifyWebhookSignature(bodyText, signature, appSecret);

    if (!isValid) {
      console.error("[Facebook Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
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
  if (!senderPsid || !pageId) {
    console.warn("[Facebook Webhook] Missing sender or recipient ID");
    return;
  }

  await messageQueue.add("facebook-message", {
    type: "facebook",
    payload: { senderPsid, pageId, messageText },
  });
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
