import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const activityLogTypes = [
  "bot_created",
  "contact_created",
  "conversation_created",
  "lead_created",
  "login",
  "logout",
  "onboarding_milestone",
  "settings_updated",
  "subscription_updated",
  "system_event",
] as const;

export type ActivityLogType = (typeof activityLogTypes)[number];

export const createActivityLogSchema = z.object({
  type: z.enum(activityLogTypes),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1000),
  entityType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().trim().min(1).max(191).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export interface RecordActivityInput {
  tenantId: string;
  userId?: string | null;
  type: ActivityLogType;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordActivity({
  tenantId,
  userId,
  type,
  title,
  description,
  entityType,
  entityId,
  metadata,
}: RecordActivityInput) {
  try {
    return await prisma.activityLog.create({
      data: {
        tenantId,
        userId: userId ?? undefined,
        type,
        title,
        description,
        entityType,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    console.error("[Activity Log] Failed to record activity", {
      tenantId,
      userId,
      type,
      entityType,
      entityId,
      error,
    });
    return null;
  }
}
