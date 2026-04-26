import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DataDeletionStatus } from "@prisma/client";
import { recordActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/**
 * CRON: Process pending data deletion requests
 * This should be called periodically (e.g., daily) to fulfill Meta's requirements.
 */
export async function GET(req: Request) {
  // Simple auth check using a cron secret
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Alert for stuck/failed requests
    await checkAndAlertStuckRequests();

    const pendingRequests = await prisma.dataDeletionRequest.findMany({
      where: {
        status: DataDeletionStatus.PENDING,
      },
      take: 10, // Process in small batches
    });

    const results = [];

    for (const request of pendingRequests) {
      try {
        await prisma.dataDeletionRequest.update({
          where: { id: request.id },
          data: { status: DataDeletionStatus.IN_PROGRESS },
        });

        // If we have a tenantId, we can do a thorough cleanup
        if (request.tenantId) {
          await cleanupTenantData(request.tenantId, request.userId);
        } else if (request.email && request.email.endsWith("@facebook-user")) {
          // If it's a specific Facebook user deletion request without a tenantId yet,
          // we should look for contacts with this Facebook PSID and scrub them.
          const psid = request.email.split("@")[0];
          await cleanupFacebookUserData(psid);
        }

        await prisma.dataDeletionRequest.update({
          where: { id: request.id },
          data: {
            status: DataDeletionStatus.COMPLETED,
            processedAt: new Date(),
          },
        });

        // Audit log
        if (request.tenantId) {
          await recordActivity({
            tenantId: request.tenantId,
            userId: request.userId,
            type: "settings_updated",
            title: "Data Deletion Completed",
            description: `Facebook data deletion request ${request.confirmationCode} has been processed.`,
            metadata: {
              requestId: request.id,
              confirmationCode: request.confirmationCode,
              email: request.email,
            },
          });
        }

        results.push({ id: request.id, status: "success" });
      } catch (error) {
        console.error(`Failed to process deletion request ${request.id}:`, error);
        await prisma.dataDeletionRequest.update({
          where: { id: request.id },
          data: {
            status: DataDeletionStatus.ERROR,
            notes: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        });
        results.push({ id: request.id, status: "failed", error });
      }
    }

    return NextResponse.json({
      processed: pendingRequests.length,
      results,
    });
  } catch (error) {
    console.error("[Cron: Process Data Deletions] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * Checks for requests that are stuck in PENDING for > 24h or have failed notes
 */
async function checkAndAlertStuckRequests() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stuckRequests = await prisma.dataDeletionRequest.findMany({
    where: {
      OR: [
        {
          status: DataDeletionStatus.PENDING,
          requestedAt: { lt: twentyFourHoursAgo },
        },
        {
          status: DataDeletionStatus.ERROR,
        },
      ],
    },
    take: 5,
  });

  for (const request of stuckRequests) {
    console.warn(`Alert: Data deletion request ${request.id} is stuck or failed:`, request);

    // Log a system event for admin visibility
    // We use a generic system tenant ID or the request's tenantId if available
    const alertTenantId = request.tenantId || "system";

    await recordActivity({
      tenantId: alertTenantId,
      type: "system_event",
      title: "Data Deletion Alert",
      description: `Request ${request.confirmationCode} for ${request.email} is stuck or failed. Manual intervention may be required.`,
      metadata: {
        requestId: request.id,
        status: request.status,
        requestedAt: request.requestedAt,
        notes: request.notes,
      },
    });
  }
}

/**
 * Performs deep cleanup for a tenant (similar to scripts/cleanup_facebook_data.py)
 */
async function cleanupTenantData(tenantId: string, userId?: string | null) {
  const pages = await prisma.facebookPage.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const pageIds = pages.map((p) => p.id);

  const operations: any[] = [
    // Delete flow assignments
    prisma.flowAssignment.deleteMany({
      where: { pageId: { in: pageIds } },
    }),
    // Delete flow sessions
    prisma.flowSession.deleteMany({
      where: { pageId: { in: pageIds } },
    }),
    // Delete onboarding sessions
    prisma.onboardingSession.deleteMany({
      where: { facebookPageId: { in: pageIds } },
    }),
    // Delete leads
    prisma.lead.deleteMany({
      where: { pageId: { in: pageIds } },
    }),
    // Unlink conversations
    prisma.crmConversation.updateMany({
      where: { facebookPageId: { in: pageIds } },
      data: { facebookPageId: null },
    }),
    // Delete the pages
    prisma.facebookPage.deleteMany({
      where: { id: { in: pageIds } },
    }),
    // Remove Facebook channels from bots
    prisma.channel.deleteMany({
      where: {
        type: "facebook",
        bot: { tenantId },
      },
    }),
    // Reset channel status
    prisma.tenantChannelStatus.updateMany({
      where: { tenantId },
      data: { facebook: false },
    }),
  ];

  // If we have a userId, we should also remove their Facebook account connection
  if (userId) {
    operations.push(
      prisma.account.deleteMany({
        where: {
          userId,
          provider: "facebook",
        },
      }),
    );
  }

  await prisma.$transaction(operations);
}

/**
 * Scrubs a specific Facebook user's data across the system
 */
async function cleanupFacebookUserData(psid: string) {
  // Find all contact identities for this PSID
  const identities = await prisma.contactIdentity.findMany({
    where: {
      type: "facebook_psid",
      value: psid,
    },
  });

  for (const identity of identities) {
    const contactId = identity.contactId;

    // Meta's "Data Deletion" requires complete removal of data received from them.
    const conversations = await prisma.crmConversation.findMany({
      where: { contactId },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    await prisma.$transaction([
      prisma.crmMessage.deleteMany({
        where: { conversationId: { in: conversationIds } },
      }),
      prisma.internalNote.deleteMany({
        where: { conversationId: { in: conversationIds } },
      }),
      prisma.lead.deleteMany({
        where: { contactId },
      }),
      prisma.onboardingSession.deleteMany({
        where: { contactId },
      }),
      prisma.flowSession.deleteMany({
        where: { userId: psid },
      }),
      prisma.crmConversation.deleteMany({
        where: { contactId },
      }),
      prisma.contactIdentity.deleteMany({
        where: { contactId },
      }),
      prisma.contact.delete({
        where: { id: contactId },
      }),
    ]);
  }

  // Also catch any FlowSessions that might not be linked to a contact yet
  await prisma.flowSession.deleteMany({
    where: { userId: psid },
  });
}
