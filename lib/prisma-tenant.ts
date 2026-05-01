import { prisma } from "./prisma";

/**
 * Creates a tenant-scoped Prisma client using extensions.
 * This ensures that all queries automatically include the tenantId filter.
 */
export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // List of models that HAVE a tenantId field
          // This should be updated as the schema grows
          const tenantModels = [
            "User",
            "TenantLeadNotificationSettings",
            "TenantChannelStatus",
            "FacebookPage",
            "Subscription",
            "NewsletterSubscriber",
            "DataDeletionRequest",
            "Revenue",
            "Bot",
            "UsageLog",
            "ActivityLog",
            "Contact",
            "WebChatSite",
            "Lead",
            "Flow",
            "OnboardingSession",
            "OnboardingMetrics",
            "CrmConversation",
            "CrmMessage",
            "InternalNote",
          ];

          if (tenantModels.includes(model)) {
            const tenantFilter = { tenantId };
            const anyArgs = args as any;
            
            if (["findFirst", "findUnique", "findMany", "count", "aggregate", "groupBy"].includes(operation)) {
              anyArgs.where = { ...anyArgs.where, ...tenantFilter };
            } else if (["update", "updateMany", "delete", "deleteMany"].includes(operation)) {
              anyArgs.where = { ...anyArgs.where, ...tenantFilter };
            } else if (operation === "upsert") {
              anyArgs.where = { ...anyArgs.where, ...tenantFilter };
              anyArgs.create = { ...anyArgs.create, ...tenantFilter };
              anyArgs.update = { ...anyArgs.update, ...tenantFilter };
            } else if (operation === "create" || operation === "createMany") {
              if (Array.isArray(anyArgs.data)) {
                anyArgs.data = anyArgs.data.map((item: any) => ({ ...item, ...tenantFilter }));
              } else {
                anyArgs.data = { ...anyArgs.data, ...tenantFilter };
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}
