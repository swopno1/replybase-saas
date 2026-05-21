import { prisma } from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/prisma-tenant";
import { sendTextMessage } from "@/lib/facebook-sender";
import logger from "@/lib/logger";

/**
 * Module 5: Recovery & Abandonment Automation
 * This worker scans for inactive but open flow sessions and sends recovery nudges.
 */
export async function processFlowRecovery() {
  const INACTIVITY_THRESHOLD_MS = 45 * 1000; // 45 seconds
  const MAX_RECOVERY_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours (don't nudge very old sessions)

  // Global scan — sessions can span multiple tenants, so use global prisma here
  const idleSessions = await prisma.flowSession.findMany({
    where: {
      isActive: true,
      updatedAt: {
        lte: new Date(Date.now() - INACTIVITY_THRESHOLD_MS),
        gte: new Date(Date.now() - MAX_RECOVERY_AGE_MS),
      },
      NOT: {
        variables: {
          path: ["recovery_sent"],
          equals: true,
        },
      },
    },
    include: {
      flow: true,
    },
  });

  for (const session of idleSessions) {
    try {
      // Resolve tenantId from the associated flow for scoped DB access
      const tenantId = session.flow?.tenantId;
      if (!tenantId) continue;

      // Tenant-scoped client — automatically injects tenantId on all queries
      const db = getTenantPrisma(tenantId);

      // Fetch contact and channel info using the scoped client
      const contact = await db.contact.findUnique({
        where: { id: session.userId },
        include: { identities: { where: { type: "facebook_psid" } } },
      });

      const psid = contact?.identities[0]?.value;
      if (!psid) continue;

      // Find the Facebook Page for this session (scopeKey is "facebook:pageId")
      // facebookPage is not tenant-scoped, so use global prisma
      const pageId = session.pageId.split(":")[1];
      const facebookPage = await prisma.facebookPage.findUnique({
        where: { facebookId: pageId },
      });

      if (!facebookPage) continue;

      // Send the "In-Chat Nudge"
      const nudgeMessage = "Just checking in — would you like me to email your recommended setup so you don't lose your progress?";
      await sendTextMessage(facebookPage.accessToken, psid, nudgeMessage);

      // Mark recovery as sent to prevent multiple nudges using the scoped client
      const variables = (session.variables as Record<string, any>) || {};
      await db.flowSession.update({
        where: { id: session.id },
        data: {
          variables: {
            ...variables,
            recovery_sent: true,
            recovery_sent_at: new Date().toISOString(),
          },
        },
      });

      logger.info({ sessionId: session.id, tenantId }, "Flow recovery nudge sent");
    } catch (error) {
      logger.error({ error, sessionId: session.id }, "Failed to process flow recovery for session");
    }
  }
}
