import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getTenantSubscription } from "@/lib/subscription";

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
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [conversations, totalCount] = await Promise.all([
      prisma.crmConversation.findMany({
        where: {
          contact: {
            tenantId: tenantId,
          },
        },
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
      prisma.crmConversation.count({
        where: {
          contact: {
            tenantId: tenantId,
          },
        },
      }),
    ]);

    return NextResponse.json({
      conversations,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("[Conversations API] Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
});

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const { ids } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0)) {
      return NextResponse.json(
        { error: "Invalid input: ids must be a non-empty array or 'ALL'" },
        { status: 400 },
      );
    }

    const where = ids === "ALL"
      ? { contact: { tenantId } }
      : { id: { in: ids }, contact: { tenantId } };

    const { count } = await prisma.crmConversation.deleteMany({
      where,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[Conversations API] Batch delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversations" },
      { status: 500 },
    );
  }
});

// POST: Create a new conversation
export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const body = await request.json();
    const validated = createConversationSchema.parse(body);

    // Check plan limits
    const subscription = await getTenantSubscription(tenantId);
    const conversationCount = await prisma.crmConversation.count({
      where: {
        contact: {
          tenantId: tenantId,
        },
      },
    });

    if (
      subscription.maxConversations > 0 &&
      conversationCount >= subscription.maxConversations
    ) {
      return NextResponse.json(
        {
          error: "Conversation limit reached. Please upgrade your plan.",
        },
        { status: 403 },
      );
    }

    // Verify contact exists and belongs to the tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: validated.contactId,
        tenantId: tenantId,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found or does not belong to the tenant" },
        { status: 404 },
      );
    }

    const conversation = await prisma.crmConversation.create({
      data: {
        contactId: validated.contactId,
        channel: validated.channel,
        botId: validated.botId,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }
    console.error("[Conversations API] Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
});
