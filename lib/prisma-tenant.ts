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
            interface PrismaQueryArgs {
              where?: Record<string, unknown>;
              data?: Record<string, unknown> | Array<Record<string, unknown>>;
              create?: Record<string, unknown>;
              update?: Record<string, unknown>;
            }
            const typedArgs = args as PrismaQueryArgs;
            if (["findFirst", "findUnique", "findMany", "count", "aggregate", "groupBy"].includes(operation)) { typedArgs.where = { ...(typedArgs.where || {}), ...tenantFilter }; }
            else if (["update", "updateMany", "delete", "deleteMany"].includes(operation)) { typedArgs.where = { ...(typedArgs.where || {}), ...tenantFilter }; }
            else if (operation === "upsert") { typedArgs.where = { ...(typedArgs.where || {}), ...tenantFilter }; typedArgs.create = { ...(typedArgs.create || {}), ...tenantFilter }; typedArgs.update = { ...(typedArgs.update || {}), ...tenantFilter }; }
            else if (operation === "create" || operation === "createMany") { if (Array.isArray(typedArgs.data)) { typedArgs.data = typedArgs.data.map((item: Record<string, unknown>) => ({ ...item, ...tenantFilter })); } else { typedArgs.data = { ...(typedArgs.data as Record<string, unknown> || {}), ...tenantFilter }; } }
          }
          return query(args);
        },
      },
    },
  });
}
