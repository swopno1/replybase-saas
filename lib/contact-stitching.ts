import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

/**
 * Merges a source contact into a target contact.
 * This is the core engine for identity unification across all channels.
 */
export async function mergeContacts(params: {
  tenantId: string;
  sourceContactId: string;
  targetContactId: string;
  reason?: string;
}) {
  const { tenantId, sourceContactId, targetContactId, reason } = params;

  if (sourceContactId === targetContactId) {
    return null;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch both contacts to merge profile data
      const [sourceContact, targetContact] = await Promise.all([
        tx.contact.findUnique({ where: { id: sourceContactId } }),
        tx.contact.findUnique({ where: { id: targetContactId } }),
      ]);

      if (!sourceContact || !targetContact) {
        throw new Error("One or both contacts not found");
      }

      // 2. Transfer Identities (handling unique constraints)
      const identities = await tx.contactIdentity.findMany({
        where: { contactId: sourceContactId },
      });

      for (const identity of identities) {
        try {
          await tx.contactIdentity.update({
            where: { id: identity.id },
            data: { contactId: targetContactId },
          });
        } catch (e) {
          // If target already has this identity, we just delete the source's duplicate
          await tx.contactIdentity.delete({ where: { id: identity.id } });
          logger.debug(
            { identity, targetContactId },
            "Identity already exists on target contact, removing source duplicate"
          );
        }
      }

      // 3. Update target contact with missing profile data
      const profileUpdates: Record<string, string> = {};
      if (!targetContact.name && sourceContact.name) profileUpdates.name = sourceContact.name;
      if (!targetContact.email && sourceContact.email) profileUpdates.email = sourceContact.email;
      if (!targetContact.phone && sourceContact.phone) profileUpdates.phone = sourceContact.phone;

      if (Object.keys(profileUpdates).length > 0) {
        await tx.contact.update({
          where: { id: targetContactId },
          data: profileUpdates,
        });
      }

      // 4. Transfer Conversations
      await tx.crmConversation.updateMany({
        where: { contactId: sourceContactId, tenantId },
        data: { contactId: targetContactId },
      });

      // 5. Transfer Leads
      await tx.lead.updateMany({
        where: { contactId: sourceContactId, tenantId },
        data: { contactId: targetContactId },
      });

      // 6. Transfer Onboarding Sessions
      await tx.onboardingSession.updateMany({
        where: { contactId: sourceContactId },
        data: { contactId: targetContactId },
      });

      // 7. Transfer Flow Sessions (userId field)
      await tx.flowSession.updateMany({
        where: { userId: sourceContactId },
        data: { userId: targetContactId },
      });

      // 8. Transfer Activity Logs
      await tx.activityLog.updateMany({
        where: {
          tenantId,
          entityType: "contact",
          entityId: sourceContactId
        },
        data: { entityId: targetContactId },
      });

      // 9. Create a record of the merge
      await tx.activityLog.create({
        data: {
          tenantId,
          type: "CONTACT_MERGED",
          title: "Contacts Unified",
          description: reason || `Contact ${sourceContactId} merged into ${targetContactId}`,
          entityType: "contact",
          entityId: targetContactId,
          metadata: {
            mergedFrom: sourceContactId,
            previousEmail: sourceContact.email,
            previousPhone: sourceContact.phone,
          }
        },
      });

      // 10. Delete the source contact
      await tx.contact.delete({
        where: { id: sourceContactId },
      });

      logger.info(
        { sourceContactId, targetContactId, tenantId },
        "Contact merge successful"
      );

      return { success: true };
    });
  } catch (error) {
    logger.error({ error, sourceContactId, targetContactId }, "Failed to merge contacts");
    throw error;
  }
}

/**
 * Merges an anonymous contact (usually from Webchat) into an identified contact 
 * (Facebook, WhatsApp, etc.) based on a session hash/token.
 * 
 * This ensures "Identity Stitching" across channels.
 */
export async function stitchContactIdentities(params: {
  tenantId: string;
  identifiedContactId: string;
  sessionHash: string;
}) {
  try {
    const anonymousSession = await prisma.flowSession.findFirst({
      where: {
        variables: {
          path: ["sync_hash"],
          equals: params.sessionHash,
        },
        isActive: true,
      },
      select: {
        userId: true,
        variables: true,
        id: true,
      },
    });

    if (!anonymousSession || anonymousSession.userId === params.identifiedContactId) {
      return null;
    }

    const anonymousContactId = anonymousSession.userId;
    const anonymousVars = (anonymousSession.variables as Record<string, any>) || {};

    // Use the generic merge utility
    await mergeContacts({
      tenantId: params.tenantId,
      sourceContactId: anonymousContactId,
      targetContactId: params.identifiedContactId,
      reason: `Contact merged with previous Webchat session (${params.sessionHash})`,
    });

    // Close the anonymous session (it was moved to the identified contact already, but we need its original ID to update it)
    // Wait, mergeContacts moved it. So we update it via its original session ID.
    await prisma.flowSession.update({
      where: { id: anonymousSession.id },
      data: {
        isActive: false,
        variables: {
          ...anonymousVars,
          stitched_into: params.identifiedContactId,
        },
      },
    });

    return {
      previousVariables: anonymousVars,
    };
  } catch (error) {
    logger.error({ error, params }, "Failed to stitch contact identities");
    return null;
  }
}
