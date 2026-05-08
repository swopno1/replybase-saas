import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { ConversationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateConversationSchema = z.object({
  assigneeId: z.string().cuid().nullable().optional(),
  status: z.nativeEnum(ConversationStatus).optional(),
  botPaused: z.boolean().optional(),
});

// GET: Retrieve a specific conversation
export const GET = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    const { conversationId } = await context.params;
    try {
      const conversation = await db.crmConversation.findFirst({
        where: {
          id: conversationId as string,
          tenantId
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
          internalNotes: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          contact: {
            include: {
              leads: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
              },
            },
          },
          webChatSessions: {
            orderBy: {
              lastSeenAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              visitorId: true,
              lastSeenAt: true,
              site: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({ conversation });
    } catch (error) {
      console.error("[Conversations API] Error fetching conversation:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversation" },
        { status: 500 },
      );
    }
  },
);

// PUT: Update a specific conversation
export const PUT = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    const { conversationId } = await context.params;
    try {
      const body = await request.json();
      const validated = updateConversationSchema.parse(body);

      const updatedConversation = await db.crmConversation.update({
        where: { id: conversationId as string, tenantId },
        data: {
          ...validated,
        },
      });

      return NextResponse.json({ conversation: updatedConversation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 },
        );
      }
      // Prisma error for not found (P2025)
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
      console.error("[Conversations API] Error updating conversation:", error);
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 },
      );
    }
  },
);

// DELETE: Delete a specific conversation
export const DELETE = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    const { conversationId } = await context.params;
    try {
      const id = conversationId as string;

      await db.$transaction(async (tx) => {
        // Verify ownership
        const conversation = await tx.crmConversation.findFirst({
           where: { id, tenantId },
           select: { id: true }
        });

        if (!conversation) {
          throw new Error("NOT_FOUND");
        }

        await tx.crmMessage.deleteMany({
          where: { conversationId: id, tenantId },
        });

        await tx.internalNote.deleteMany({
          where: { conversationId: id, tenantId },
        });

        await tx.crmConversation.delete({
          where: { id, tenantId },
        });
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
      console.error("[Conversations API] Error deleting conversation:", error);
      return NextResponse.json(
        { error: "Failed to delete conversation" },
        { status: 500 },
      );
    }
  },
);
