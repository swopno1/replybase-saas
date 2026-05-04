import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// Introspect the Prisma DMMF to automatically identify models with a tenantId field.
// This ensures that the tenant isolation logic stays in sync with the schema without manual updates.
const tenantModels = (Prisma as any).dmmf.datamodel.models
  .filter((m: any) => m.fields.some((f: any) => f.name === "tenantId"))
  .map((m: any) => m.name);

/**
 * Creates a tenant-scoped Prisma client using extensions.
 * This ensures that all queries automatically include the tenantId filter.
 */
export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
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
