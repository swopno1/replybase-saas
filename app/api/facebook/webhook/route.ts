import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    // Skip non-message events, echoes, and receipts for MVP
    if (event.delivery || event.read || event.postback || !event.message || event.message.is_echo) {
      return;
    }

    const { sender, recipient, message } = event;
    const senderPsid = sender?.id;
    const pageId = recipient?.id;
    const messageText = message?.text;

    if (!messageText) {
      // For MVP, we only handle text messages.
      return;
    }

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

    if (!facebookPage.engineConnected || !facebookPage.botId || !facebookPage.tenantId) {
      console.warn(`[Facebook Webhook] Page ${pageId} is not configured for AI.`);
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
        userName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
      }
    } catch (error) {
      console.warn("[Facebook Webhook] Could not fetch user profile:", error);
    }

    // 3. Find or create Contact and Conversation
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: tenantId,
        identities: { some: { type: 'facebook_psid', value: senderPsid } },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: tenantId,
          name: userName || senderPsid, // Fallback to PSID if name fetch fails
          identities: {
            create: { type: 'facebook_psid', value: senderPsid },
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
          channel: 'facebook',
          botId: botId,
          facebookPageId: facebookPage.id, // Correctly link the conversation to the page
        },
      });
    }

    // 4. Log inbound message to CRM
    await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'inbound',
        content: messageText,
        source: 'human',
      },
    });

    // 5. Send to AI Engine
    let replyText: string;
    try {
      const engineResponse = await converse({
        botId,
        tenantId,
        contact: {
          name: userName || senderPsid,
        },
        message: messageText,
      });

      type TextResponse = { type: 'text', text: string };
      const textResponse = engineResponse.responses?.find((r: TextResponse) => r.type === 'text');
      replyText = textResponse?.text;

      if (!replyText) {
        throw new Error("No text response from engine");
      }
    } catch (error) {
      console.error("[Facebook Webhook] AI Engine Error:", error);
      replyText = "Sorry, I'm having trouble responding right now.";
    }

    // 5. Send reply to Facebook
    await sendTextMessage(accessToken, senderPsid, replyText);

    // 6. Log outbound message to CRM
    await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'outbound',
        content: replyText,
        source: 'ai',
      },
    });

  } catch (error) {
    console.error("[Facebook Webhook] Unhandled error in handleMessagingEvent:", error);
  }
}
