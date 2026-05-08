import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { isChannelEnabled } from "@/lib/channel-config";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const POST = withAuthAndTenant(
  async ({ tenantId }, req, context, db) => {
    if (!isChannelEnabled("facebook")) {
      return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
    }

    const { pageId, pageName, accessToken } = await req.json();
    if (!pageId || !pageName || !accessToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      const defaultBot = await db.bot.findFirst({
        where: { tenantId },
        select: { id: true },
      });

      if (!defaultBot) {
        return NextResponse.json({ error: "No bot found for tenant. Create a bot first." }, { status: 400 });
      }

      const facebookPage = await db.facebookPage.upsert({
        where: { facebookId: pageId, tenantId },
        update: {
          name: pageName,
          accessToken,
          botId: defaultBot.id,
        },
        create: {
          facebookId: pageId,
          name: pageName,
          accessToken,
          tenantId,
          botId: defaultBot.id,
          engineConnected: false,
        },
      });

      await recordWebhookSetupLog({
        source: "facebook",
        event: "page_connect",
        outcome: "setup_success",
        tenantId,
        channelId: pageId,
        metadata: { pageName, isNew: !facebookPage },
      });

      let webhookSubscribed = false;
      try {
        const subUrl = getFacebookGraphUrl(`${pageId}/subscribed_apps`, accessToken, {
          subscribed_fields: "messages,messaging_postbacks,messaging_optins,messaging_referrals",
        });
        const subRes = await fetch(subUrl, { method: "POST" });
        if (subRes.ok) {
          webhookSubscribed = true;
          await db.facebookPage.update({
            where: { id: facebookPage.id, tenantId },
            data: { webhookSubscribed: true },
          });
        }
      } catch {}

      return NextResponse.json({ success: true, pageId, webhookSubscribed });
    } catch (error) {
      console.error("[Facebook Integration] Error:", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  }
);

export const DELETE = withAuthAndTenant(
  async ({ tenantId, id: userId }, req, context, db) => {
    if (!isChannelEnabled("facebook")) return NextResponse.json({ error: "Disabled" }, { status: 403 });

    try {
      const account = await db.account.findFirst({ where: { userId, provider: "facebook" } });
      if (account?.access_token) {
        try {
          const revokeUrl = getFacebookGraphUrl("me/permissions", account.access_token);
          await fetch(revokeUrl, { method: "DELETE" });
        } catch {}
      }

      const facebookPages = await db.facebookPage.findMany({ where: { tenantId }, select: { id: true } });
      const pageIds = facebookPages.map((p) => p.id);
      const conversations = await db.crmConversation.findMany({ where: { facebookPageId: { in: pageIds }, tenantId }, select: { id: true } });
      const conversationIds = conversations.map((c) => c.id);

      await db.$transaction([
        db.crmMessage.deleteMany({ where: { conversationId: { in: conversationIds }, tenantId } }),
        db.flowAssignment.deleteMany({ where: { pageId: { in: pageIds } } }),
        db.crmConversation.deleteMany({ where: { facebookPageId: { in: pageIds }, tenantId } }),
        db.lead.deleteMany({ where: { pageId: { in: pageIds }, tenantId } }),
        db.flowSession.deleteMany({ where: { pageId: { in: pageIds } } }),
        db.onboardingSession.deleteMany({ where: { facebookPageId: { in: pageIds }, tenantId } }),
        db.facebookPage.deleteMany({ where: { tenantId } }),
        db.account.deleteMany({ where: { userId, provider: "facebook" } }),
      ]);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[Facebook Integration] DELETE error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);
