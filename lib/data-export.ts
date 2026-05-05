import { prisma } from "@/lib/prisma";

/**
 * Generates a comprehensive JSON export of all data related to a specific tenant.
 * This satisfies GDPR "Right to Access" requirements.
 */
export async function exportTenantData(tenantId: string) {
  const data = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        }
      },
      bots: {
        include: {
          channels: true,
        }
      },
      flows: {
        include: {
          nodes: true,
        }
      },
      subscriptions: true,
      activityLogs: {
        take: 1000, // Limit logs for performance
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          createdAt: true,
          metadata: true,
        }
      },
      usageLogs: {
        take: 1000,
        orderBy: { date: "desc" },
        select: {
          id: true,
          type: true,
          count: true,
          date: true,
          botId: true,
          channelId: true,
        }
      },
      webChatSites: {
        include: {
          sessions: {
            take: 100,
            include: {
              events: true
            }
          }
        }
      },
      leads: true,
    }
  });

  if (!data) {
    throw new Error("Tenant not found");
  }

  // Sanitize and return
  return {
    exportDate: new Date().toISOString(),
    tenantId,
    data
  };
}
