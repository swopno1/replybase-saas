import { prisma } from "@/lib/prisma";
import { sendTextMessage } from "@/lib/facebook-sender";
import logger from "@/lib/logger";

/**
 * Module 5: Recovery & Abandonment Automation
 * This worker scans for inactive but open flow sessions and sends recovery nudges.
 */
export async function processFlowRecovery() {
  const INACTIVITY_THRESHOLD_MS = 45 * 1000; // 45 seconds
  const MAX_RECOVERY_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours (don't nudge very old sessions)

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
      // Fetch contact and channel info
      const contact = await prisma.contact.findUnique({
        where: { id: session.userId },
        include: { identities: { where: { type: "facebook_psid" } } },
      });

      const psid = contact?.identities[0]?.value;
      if (!psid) continue;

      // Find the Facebook Page for this session (scopeKey is "facebook:pageId")
      const pageId = session.pageId.split(":")[1];
      const facebookPage = await prisma.facebookPage.findUnique({
        where: { facebookId: pageId },
      });

      if (!facebookPage) continue;

      // Send the "In-Chat Nudge"
      const nudgeMessage = "Just checking in — would you like me to email your recommended setup so you don't lose your progress?";
      await sendTextMessage(facebookPage.accessToken, psid, nudgeMessage);

      // Mark recovery as sent to prevent multiple nudges
      const variables = (session.variables as Record<string, any>) || {};
      await prisma.flowSession.update({
        where: { id: session.id },
        data: {
          variables: {
            ...variables,
            recovery_sent: true,
            recovery_sent_at: new Date().toISOString(),
          },
        },
      });

      logger.info({ sessionId: session.id }, "Flow recovery nudge sent");
    } catch (error) {
      logger.error({ error, sessionId: session.id }, "Failed to process flow recovery for session");
    }
  }
}
