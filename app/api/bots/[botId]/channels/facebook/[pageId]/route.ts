import { NextResponse } from "next/server";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const DELETE = withAuthAndTenant(async ({ tenantId }, _req, context, db) => {
  const { botId, pageId } = (await context.params) as { botId: string; pageId: string };
  if (!pageId) {
    return NextResponse.json({ error: "Page ID is required" }, { status: 400 });
  }

  try {
    // Find the Facebook page to verify it belongs to this tenant and bot
    const facebookPage = await db.facebookPage.findFirst({
      where: {
        facebookId: pageId,
        botId: botId,
        tenantId: tenantId,
      },
    });

    if (!facebookPage) {
      return NextResponse.json(
        { error: "Facebook page not found" },
        { status: 404 },
      );
    }

    // Unsubscribe page from webhook events before deleting
    if (facebookPage.webhookSubscribed && facebookPage.accessToken) {
      try {
        const unsubUrl = getFacebookGraphUrl(
          `${pageId}/subscribed_apps`,
          facebookPage.accessToken,
        );
        await fetch(unsubUrl, { method: "DELETE" });
      } catch (unsubError) {
        console.error(
          "[Facebook Integration] Failed to unsubscribe page:",
          unsubError,
        );
      }
    }

    // Delete in correct order using the scoped db client
    await db.flowAssignment.deleteMany({ where: { pageId: facebookPage.id } });
    const conversations = await db.crmConversation.findMany({
      where: { facebookPageId: facebookPage.id },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);
    await db.crmMessage.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await db.internalNote.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await db.crmConversation.deleteMany({ where: { facebookPageId: facebookPage.id } });
    await db.lead.deleteMany({ where: { pageId: facebookPage.id } });
    await db.flowSession.deleteMany({ where: { pageId: facebookPage.id } });
    await db.onboardingSession.deleteMany({ where: { facebookPageId: facebookPage.id } });
    await db.channel.deleteMany({
      where: { 
        type: "facebook", 
        channelId: facebookPage.facebookId 
      } 
    });
    await db.facebookPage.delete({ where: { id: facebookPage.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Facebook Integration] Error unlinking page:", error);
    return NextResponse.json({ error: "Failed to unlink page" }, { status: 500 });
  }
});
