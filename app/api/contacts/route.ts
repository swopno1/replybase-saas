import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const createContactSchema = z
  .object({
    name: z.string().max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.name && !data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one of 'name', 'email', or 'phone' must be provided.",
      });
    }
  });

// GET: List tenant's contacts
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [contacts, totalCount] = await Promise.all([
      db.contact.findMany({
        where: {}, // tenantId is automatically injected by db extension
        include: {
          conversations: {
            select: { id: true, channel: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
          },
          identities: { select: { type: true, value: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.contact.count({
        where: {}, // tenantId is automatically injected
      }),
    ]);

    return successResponse(contacts, 200, {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      limit,
    });
  } catch (error) {
    console.error("[Contacts API] Error fetching contacts:", error);
    return errorResponse("Failed to fetch contacts");
  }
});

// POST: Create a new contact
export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ id, tenantId }, request, context, db) => {
    try {
      const body = await request.json();
      const validated = createContactSchema.parse(body);

      const contact = await db.contact.create({
        data: {
          tenantId,
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
        },
      });

      await recordActivity({
        tenantId,
        userId: id,
        type: "contact_created",
        title: "Contact Added",
        description: `Added contact ${contact.name || contact.email || contact.phone || contact.id}`,
        entityType: "contact",
        entityId: contact.id,
      });

      return successResponse({ contact }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse(error);
      }
      console.error("[Contacts API] Error creating contact:", error);
      return errorResponse("Failed to create contact");
    }
  },
);

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { ids } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0)) {
      return NextResponse.json(
        { error: "Invalid input: ids must be a non-empty array or 'ALL'" },
        { status: 400 },
      );
    }

    // Filter for contacts
    const where = ids === "ALL" ? {} : { id: { in: ids } };
    // Filter for related records using contactId
    const relatedWhere = ids === "ALL" ? {} : { contactId: { in: ids } };

    // Use a transaction to ensure all related data is cleaned up before contacts are deleted
    const result = await db.$transaction(async (tx) => {
      // 1. Delete ContactIdentities
      await tx.contactIdentity.deleteMany({ where: relatedWhere });
      
      // 2. Delete CrmConversations (Messages, Notes, and WebChatSessions will cascade)
      await tx.crmConversation.deleteMany({ where: relatedWhere });
      
      // 3. Delete Leads
      await tx.lead.deleteMany({ where: relatedWhere });
      
      // 4. Delete OnboardingSessions
      await tx.onboardingSession.deleteMany({ where: relatedWhere });

      // 5. Finally, delete the Contacts
      return await tx.contact.deleteMany({ where });
    });

    return successResponse({ count: result.count });
  } catch (error) {
    console.error("[Contacts API] Batch delete error:", error);
    return errorResponse("Failed to delete contacts");
  }
});
