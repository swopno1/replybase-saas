import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getTenantLimits } from "@/lib/subscription";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api-response";

export const dynamic = 'force-dynamic';




const createConversationSchema = z.object({
  contactId: z.string().cuid(),
  channel: z.string().min(1).max(50),
  botId: z.string().cuid().optional(),
});

// GET: List tenant's conversations
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [conversations, totalCount] = await Promise.all([
      db.crmConversation.findMany({
        where: {}, // tenantId is automatically injected
        include: {
          contact: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      db.crmConversation.count({
        where: {}, // tenantId is automatically injected
      }),
    ]);

    return successResponse(conversations, 200, {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
    });
  } catch (error) {
    console.error("[Conversations API] Error fetching conversations:", error);
    return errorResponse("Failed to fetch conversations");
  }
});

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { ids } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0)) {
      return errorResponse("Invalid input: ids must be a non-empty array or 'ALL'", 400);
    }

    const where = ids === "ALL" ? {} : { id: { in: ids } };

    const { count } = await db.crmConversation.deleteMany({
      where,
    });

    return successResponse({ count });
  } catch (error) {
    console.error("[Conversations API] Batch delete error:", error);
    return errorResponse("Failed to delete conversations");
  }
});

// POST: Create a new conversation
export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const body = await request.json();
    const validated = createConversationSchema.parse(body);

    // Check plan limits
    const subscription = await getTenantLimits(tenantId);
    const conversationCount = await db.crmConversation.count({
      where: {}, // tenantId automatically injected
    });

    if (
      subscription.maxConversations > 0 &&
      conversationCount >= subscription.maxConversations
    ) {
      return errorResponse("Conversation limit reached. Please upgrade your plan.", 403);
    }

    // Verify contact exists and belongs to the tenant
    const contact = await db.contact.findFirst({
      where: {
        id: validated.contactId,
      },
    });

    if (!contact) {
      return errorResponse("Contact not found", 404);
    }

    const conversation = await db.crmConversation.create({
      data: {
        tenantId,
        contactId: validated.contactId,
        channel: validated.channel,
        botId: validated.botId,
      },
    });

    return successResponse({ conversation }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(error);
    }
    console.error("[Conversations API] Error creating conversation:", error);
    return errorResponse("Failed to create conversation");
  }
});
