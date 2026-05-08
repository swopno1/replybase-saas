import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  try {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "facebook" },
    });

    if (account?.access_token) {
      try {
        const revokeUrl = getFacebookGraphUrl("me/permissions", account.access_token);
        await fetch(revokeUrl, { method: "DELETE" });
      } catch (revokeErr) {
        console.warn("[Facebook Disconnect] Could not revoke Meta permissions:", revokeErr);
      }
    }

    const facebookPages = await prisma.facebookPage.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const pageIds = facebookPages.map((p) => p.id);

    const conversations = await prisma.crmConversation.findMany({
      where: { facebookPageId: { in: pageIds } },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    await prisma.$transaction([
      prisma.crmMessage.deleteMany({ where: { conversationId: { in: conversationIds } } }),
      prisma.flowAssignment.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.crmConversation.deleteMany({ where: { facebookPageId: { in: pageIds } } }),
      prisma.lead.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.flowSession.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.onboardingSession.deleteMany({ where: { facebookPageId: { in: pageIds } } }),
      prisma.facebookPage.deleteMany({ where: { tenantId } }),
      prisma.account.deleteMany({ where: { userId, provider: "facebook" } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Facebook Disconnect] Error:", error);
    return NextResponse.json({ error: "Failed to disconnect Facebook account" }, { status: 500 });
  }
}
