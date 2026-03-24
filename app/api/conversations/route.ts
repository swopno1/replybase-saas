import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getTenantSubscription } from "@/lib/subscription";

const createConversationSchema = z.object({
  contactId: z.string().cuid(),
  channel: z.string().min(1).max(50),
  botId: z.string().cuid().optional(),
});

// GET: List tenant's conversations
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }) => {
  try {
    const conversations = await prisma.crmConversation.findMany({
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
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("[Conversations API] Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
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
