import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ botId: string; pageId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });
  }

  const { botId, pageId } = await params;
  if (!pageId) {
    return NextResponse.json({ error: "Page ID is required" }, { status: 400 });
  }

  try {
    // Find the Facebook page to verify it belongs to this tenant and bot
    const facebookPage = await prisma.facebookPage.findFirst({
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
          `\${pageId}/subscribed_apps`,
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

    // Delete in correct order
    await prisma.flowAssignment.deleteMany({ where: { pageId: facebookPage.id } });
    const conversations = await prisma.crmConversation.findMany({
      where: { facebookPageId: facebookPage.id },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);
    await prisma.crmMessage.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await prisma.internalNote.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await prisma.crmConversation.deleteMany({ where: { facebookPageId: facebookPage.id } });
    await prisma.lead.deleteMany({ where: { pageId: facebookPage.id } });
    await prisma.flowSession.deleteMany({ where: { pageId: facebookPage.id } });
    await prisma.onboardingSession.deleteMany({ where: { facebookPageId: facebookPage.id } });
    await prisma.channel.deleteMany({ 
      where: { 
        type: "facebook", 
        channelId: facebookPage.facebookId 
      } 
    });
    await prisma.facebookPage.delete({ where: { id: facebookPage.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Facebook Integration] Error unlinking page:", error);
    return NextResponse.json({ error: "Failed to unlink page" }, { status: 500 });
  }
}
