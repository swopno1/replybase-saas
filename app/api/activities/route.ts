import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { activityLogTypes, createActivityLogSchema } from "@/lib/activity-log";
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
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const query = getActivitiesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const sinceDate = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const includeType = (type: (typeof activityLogTypes)[number]) => {
      return !query.type || query.type === type;
    };

    const [loggedActivities, bots, contacts, leads, milestones] =
      await Promise.all([
        prisma.activityLog.findMany({
          where: {
            tenantId,
            createdAt: { gte: sinceDate },
            ...(query.type && { type: query.type }),
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
          orderBy: { createdAt: "desc" },
          take: query.limit,
        }),
        includeType("bot_created")
          ? prisma.bot.findMany({
              where: { tenantId, createdAt: { gte: sinceDate } },
              select: { id: true, name: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: query.limit,
            })
          : Promise.resolve([]),
        includeType("contact_created")
          ? prisma.contact.findMany({
              where: { tenantId, createdAt: { gte: sinceDate } },
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: query.limit,
            })
          : Promise.resolve([]),
        includeType("lead_created")
          ? prisma.lead.findMany({
              where: { tenantId, createdAt: { gte: sinceDate } },
              select: {
                id: true,
                name: true,
                email: true,
                source: true,
                status: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: query.limit,
            })
          : Promise.resolve([]),
        includeType("onboarding_milestone")
          ? prisma.onboardingMilestoneEvent.findMany({
              where: { tenantId, createdAt: { gte: sinceDate } },
              select: {
                id: true,
                milestoneId: true,
                context: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: query.limit,
            })
          : Promise.resolve([]),
      ]);

    const mappedLoggedActivities = loggedActivities.map(toActivityItem);
    const loggedSignatures = new Set(
      mappedLoggedActivities
        .map(getActivitySignature)
        .filter((value: string | null): value is string => value !== null),
    );

    const derivedActivities: ActivityResponseItem[] = [
      ...bots.map((bot: { id: string; name: string; createdAt: Date }) => ({
        id: `derived-bot-${bot.id}`,
        type: "bot_created",
        title: "Bot Created",
        description: `Created bot ${bot.name}`,
        createdAt: bot.createdAt.toISOString(),
        metadata: { botName: bot.name },
        entityType: "bot",
        entityId: bot.id,
        source: "derived" as const,
      })),
      ...contacts.map(
        (contact: {
          id: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          createdAt: Date;
        }) => ({
          id: `derived-contact-${contact.id}`,
          type: "contact_created",
          title: "Contact Added",
          description: `Added contact ${
            contact.name || contact.email || contact.phone || contact.id
          }`,
          createdAt: contact.createdAt.toISOString(),
          metadata: {
            ...(contact.name ? { name: contact.name } : {}),
            ...(contact.email ? { email: contact.email } : {}),
            ...(contact.phone ? { phone: contact.phone } : {}),
          },
          entityType: "contact",
          entityId: contact.id,
          source: "derived" as const,
        }),
      ),
      ...leads.map(
        (lead: {
          id: string;
          name: string | null;
          email: string | null;
          source: string;
          status: string;
          createdAt: Date;
        }) => ({
          id: `derived-lead-${lead.id}`,
          type: "lead_created",
          title: "Lead Captured",
          description: `Captured ${lead.source} lead from ${
            lead.name || lead.email || lead.id
          }`,
          createdAt: lead.createdAt.toISOString(),
          metadata: {
            source: lead.source,
            status: lead.status,
            ...(lead.email ? { email: lead.email } : {}),
          },
          entityType: "lead",
          entityId: lead.id,
          source: "derived" as const,
        }),
      ),
      ...milestones.map(
        (milestone: {
          id: string;
          milestoneId: string;
          context: Prisma.JsonValue | null;
          createdAt: Date;
        }) => ({
          id: `derived-milestone-${milestone.id}`,
          type: "onboarding_milestone",
          title: "Onboarding Milestone Completed",
          description: `Completed milestone ${milestone.milestoneId}`,
          createdAt: milestone.createdAt.toISOString(),
          metadata: {
            milestoneId: milestone.milestoneId,
            ...(coerceMetadata(milestone.context) || {}),
          },
          entityType: "onboarding_milestone",
          entityId: milestone.id,
          source: "derived" as const,
        }),
      ),
    ].filter((activity) => {
      const signature = getActivitySignature(activity);
      return !signature || !loggedSignatures.has(signature);
    });

    const activities = [...mappedLoggedActivities, ...derivedActivities]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .slice(0, query.limit);

    return NextResponse.json({
      activities,
      filters: {
        type: query.type ?? null,
        limit: query.limit,
        days: query.days,
      },
    });
  } catch (error) {
    console.error("[Activities API] Failed to fetch activities", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 },
    );
  }
});

export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ id, tenantId }, request) => {
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
  },
);
