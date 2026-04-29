import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { ConversationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateConversationSchema = z.object({
  assigneeId: z.string().cuid().nullable().optional(),
  status: z.nativeEnum(ConversationStatus).optional(),
  botPaused: z.boolean().optional(),
});

async function getConversation(conversationId: string, tenantId: string) {
  return await prisma.crmConversation.findFirst({
    where: {
      id: conversationId,
      contact: {
        tenantId: tenantId,
      },
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

  return conversation;
}

// GET: Retrieve a specific conversation
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { conversationId } = await context.params;
    try {
      const conversation = await getConversation(
        conversationId as string,
        tenantId,
      );

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
export const PUT: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { conversationId } = await context.params;
    try {
      const conversation = await getConversation(
        conversationId as string,
        tenantId,
      );
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      const body = await request.json();
      const validated = updateConversationSchema.parse(body);

      const updatedConversation = await prisma.crmConversation.update({
        where: { id: conversationId as string },
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
      console.error("[Conversations API] Error updating conversation:", error);
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 },
      );
    }
  },
);

// DELETE: Delete a specific conversation
export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { conversationId } = await context.params;
    try {
      const conversation = await getConversation(
        conversationId as string,
        tenantId,
      );
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      const id = conversationId as string;

      await prisma.$transaction(async (tx) => {
        await tx.crmMessage.deleteMany({
          where: { conversationId: id },
        });

        await tx.internalNote.deleteMany({
          where: { conversationId: id },
        });

        await tx.crmConversation.delete({
          where: { id },
        });
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error("[Conversations API] Error deleting conversation:", error);
      return NextResponse.json(
        { error: "Failed to delete conversation" },
        { status: 500 },
      );
    }
  },
);
