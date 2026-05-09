import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

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
    // 1. Find the anonymous session/contact associated with this hash
    // The hash is typically stored in the session metadata or a dedicated lookup table.
    // For this implementation, we check FlowSession variables for the sync_hash.
    const anonymousSession = await prisma.flowSession.findFirst({
      where: {
        variables: {
          path: ["sync_hash"],
          equals: params.sessionHash,
        },
        isActive: true,
      },
      select: {
        userId: true, // This is the contactId in our system
        variables: true,
        id: true,
      },
    });

    if (!anonymousSession || anonymousSession.userId === params.identifiedContactId) {
      return null;
    }

    const anonymousContactId = anonymousSession.userId;

    // 2. Fetch all variables from the anonymous session
    const anonymousVars = (anonymousSession.variables as Record<string, any>) || {};

    // 3. Move/Merge identities from anonymous contact to identified contact
    const identities = await prisma.contactIdentity.findMany({
      where: { contactId: anonymousContactId },
    });

    for (const identity of identities) {
      try {
        await prisma.contactIdentity.update({
          where: { id: identity.id },
          data: { contactId: params.identifiedContactId },
        });
      } catch (e) {
        // Handle unique constraint if identified contact already has this identity
        logger.debug({ identity }, "Identity already exists on target contact, skipping merge");
      }
    }

    // 4. Update the identified contact with missing profile data
    const anonymousContact = await prisma.contact.findUnique({
      where: { id: anonymousContactId },
    });

    if (anonymousContact) {
      await prisma.contact.update({
        where: { id: params.identifiedContactId },
        data: {
          name: anonymousContact.name || undefined,
          email: anonymousContact.email || undefined,
          phone: anonymousContact.phone || undefined,
        },
      });
    }

    // 5. Transfer conversation history (Optional but recommended for continuity)
    await prisma.crmConversation.updateMany({
      where: { contactId: anonymousContactId, tenantId: params.tenantId },
      data: { contactId: params.identifiedContactId },
    });

    // 6. Close the anonymous session and mark it as stitched
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

    logger.info(
      { anonymousContactId, identifiedContactId: params.identifiedContactId },
      "Identity stitching successful"
    );

    return {
      previousVariables: anonymousVars,
    };
  } catch (error) {
    logger.error({ error, params }, "Failed to stitch contact identities");
    return null;
  }
}
