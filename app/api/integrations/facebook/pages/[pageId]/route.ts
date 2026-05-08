import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const dynamic = "force-dynamic";

export const DELETE = withAuthAndTenant(
  async ({ tenantId }, req, context, db) => {
    const { pageId } = await context.params;
    if (!pageId) {
      return NextResponse.json({ error: "Page ID is required" }, { status: 400 });
    }

    try {
      // Find the Facebook page to verify it belongs to this tenant
      const facebookPage = await db.facebookPage.findFirst({
        where: {
          facebookId: pageId as string,
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

      // Delete in correct order to respect foreign key constraints
      await db.$transaction(async (tx) => {
        // 1. Delete flow assignments for this page
        await tx.flowAssignment.deleteMany({
          where: {
            pageId: facebookPage.id,
            tenantId
          },
        });

        // 2. Collect conversation IDs so child records can be deleted first
        const conversations = await tx.crmConversation.findMany({
          where: { facebookPageId: facebookPage.id, tenantId },
          select: { id: true },
        });
        const conversationIds = conversations.map((c) => c.id);

        // 3. Delete messages (no cascade in schema)
        await tx.crmMessage.deleteMany({
          where: { conversationId: { in: conversationIds }, tenantId },
        });

        // 4. Delete internal notes (no cascade in schema)
        await tx.internalNote.deleteMany({
          where: { conversationId: { in: conversationIds }, tenantId },
        });

        // 5. Delete conversations (WebChatSession cascades automatically)
        await tx.crmConversation.deleteMany({
          where: {
            facebookPageId: facebookPage.id,
            tenantId
          },
        });

        // 6. Delete leads for this page
        await tx.lead.deleteMany({
          where: {
            pageId: facebookPage.id,
            tenantId
          },
        });

        // 7. Delete flow sessions related to this page
        await tx.flowSession.deleteMany({
          where: {
            pageId: facebookPage.id,
            tenantId
          },
        });

        // 8. Delete onboarding sessions for this page
        await tx.onboardingSession.deleteMany({
          where: {
            facebookPageId: facebookPage.id,
            tenantId
          },
        });

        // 9. Finally delete the Facebook page
        await tx.facebookPage.delete({
          where: {
            id: facebookPage.id,
            tenantId
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Page and all related data unlinked successfully",
      });
    } catch (error) {
      console.error("[Facebook Integration] Error unlinking page:", error);
      return NextResponse.json(
        {
          error: "Failed to unlink page",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      );
    }
  }
);
