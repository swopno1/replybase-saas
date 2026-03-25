import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  activityLogTypes,
  createActivityLogSchema,
} from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const getActivitiesQuerySchema = z.object({
  type: z.enum(activityLogTypes).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

type ActivityResponseItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  entityType?: string | null;
  entityId?: string | null;
  source: "logged" | "derived";
};

function coerceMetadata(
  metadata: Prisma.JsonValue | null,
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  return metadata as Record<string, unknown>;
}

function toActivityItem(activity: {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  entityType: string | null;
  entityId: string | null;
}): ActivityResponseItem {
  return {
    id: activity.id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    createdAt: activity.createdAt.toISOString(),
    metadata: coerceMetadata(activity.metadata),
    entityType: activity.entityType,
    entityId: activity.entityId,
    source: "logged",
  };
}

function getActivitySignature(activity: {
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  if (!activity.entityType || !activity.entityId) {
    return null;
  }

  return `${activity.type}:${activity.entityType}:${activity.entityId}`;
}

export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }) => {
  try {
    const query = getActivitiesQuerySchema.parse({
      type: undefined,
      limit: 50,
      days: 30,
    });

    return NextResponse.json({ activities: [], defaults: query });
  } catch {
    return NextResponse.json({ activities: [] });
  }
});

export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> = withAuthAndTenant(async ({ id, tenantId }, request) => {
  try {
    const body = await request.json();
    const parsed = createActivityLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const activity = await prisma.activityLog.create({
      data: {
        tenantId,
        userId: id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        createdAt: true,
        metadata: true,
        entityType: true,
        entityId: true,
      },
    });

    return NextResponse.json(
      { activity: toActivityItem(activity) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Activities API] Failed to create activity", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 },
    );
  }
});