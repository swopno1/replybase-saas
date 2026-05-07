import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { messageQueue } from "@/lib/queue";
import { verifyWebhookSignature } from "@/lib/server/facebook-utils";
import { isChannelEnabled } from "@/lib/channel-config";

export async function GET(req: NextRequest) {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  try {
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

    if (!appSecret || !signature) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const bodyText = await req.text();
    const isValid = verifyWebhookSignature(bodyText, signature, appSecret);
    if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });

    const body = JSON.parse(bodyText);

    if (body.object === "page" && body.entry) {
      for (const entry of body.entry) {
        const messaging = entry.messaging;
        if (!messaging || !Array.isArray(messaging)) continue;

        for (const event of messaging) {
          handleMessagingEvent(event).catch((err) =>
            logger.error({ error: err }, "[Facebook Webhook] Async processing error")
          );
        }
      }
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

async function handleMessagingEvent(event: any) {
  try {
    if (event.delivery || event.read || event.message?.is_echo) return;

    const senderPsid = event.sender?.id;
    const pageId = event.recipient?.id;
    if (!senderPsid || !pageId) return;

    // Multi-bot lookup: Find the specific FacebookPage record using the pageId (facebookId field)
    const pageRecord = await prisma.facebookPage.findFirst({
      where: { facebookId: pageId },
      include: { bot: true }
    });

    if (!pageRecord || !pageRecord.botId) {
      logger.warn(`[Facebook Webhook] Unlinked page received: ${pageId}`);
      return;
    }

    const mid = event.message?.mid;
    if (mid) {
      const eventKey = `mid:${mid}`;
      try {
        await prisma.webhookLog.create({
          data: {
            type: "message",
            source: "facebook",
            event: eventKey,
            data: { ...event, botId: pageRecord.botId } as any,
          },
        });
      } catch (err: any) {
        if (err.code === "P2002") return;
        throw err;
      }
    }

    const messageText = event.postback?.payload || event.message?.quick_reply?.payload || event.message?.text;
    if (!messageText) return;

    await messageQueue.add("facebook-message", {
      type: "facebook",
      botId: pageRecord.botId,
      payload: { senderPsid, pageId, messageText },
    });
  } catch (error) {
    logger.error({ error }, "[Facebook Webhook] handleMessagingEvent error");
  }
}
