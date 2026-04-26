import { prisma } from "@/lib/prisma";

export type AdminAction =
  | "USER_PROMOTED"
  | "USER_DEMOTED"
  | "USER_DELETED"
  | "SUBSCRIPTION_UPDATED"
  | "PLAN_MODIFIED"
  | "TENANT_DELETED"
  | "SYSTEM_CONFIG_CHANGED"
  | "DATA_DELETION_PROCESSED";

interface LogParams {
  adminId: string;
  action: AdminAction | string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAdminActivity({
  adminId,
  action,
  entityType,
  entityId,
  description,
  metadata,
  ipAddress,
  userAgent,
}: LogParams) {
  try {
    return await prisma.adminActivity.create({
      data: {
        adminId,
        action,
        entityType,
        entityId,
        description,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log admin activity:", error);
    // Don't throw here to avoid failing the main action if logging fails
  }
}
