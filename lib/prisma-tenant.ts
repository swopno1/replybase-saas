import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
interface DmmfModel { name: string; fields: Array<{ name: string }>; }
const dmmf = (Prisma as unknown as { dmmf: { datamodel: { models: DmmfModel[] } } }).dmmf;
const tenantModels = dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "tenantId")).map((m) => m.name);
export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (tenantModels.includes(model)) {
            const tenantFilter = { tenantId };
            const anyArgs = args as Record<string, unknown>;
            if (["findFirst", "findUnique", "findMany", "count", "aggregate", "groupBy"].includes(operation)) { anyArgs.where = { ...(anyArgs.where as Record<string, unknown>), ...tenantFilter }; }
            else if (["update", "updateMany", "delete", "deleteMany"].includes(operation)) { anyArgs.where = { ...(anyArgs.where as Record<string, unknown>), ...tenantFilter }; }
            else if (operation === "upsert") { anyArgs.where = { ...(anyArgs.where as Record<string, unknown>), ...tenantFilter }; anyArgs.create = { ...(anyArgs.create as Record<string, unknown>), ...tenantFilter }; anyArgs.update = { ...(anyArgs.update as Record<string, unknown>), ...tenantFilter }; }
            else if (operation === "create" || operation === "createMany") { if (Array.isArray(anyArgs.data)) { anyArgs.data = anyArgs.data.map((item: Record<string, unknown>) => ({ ...item, ...tenantFilter })); } else { anyArgs.data = { ...(anyArgs.data as Record<string, unknown>), ...tenantFilter }; } }
          }
          return query(args);
        },
      },
    },
  });
}
