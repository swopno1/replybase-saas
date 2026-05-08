import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';




const createNoteSchema = z.object({
  content: z.string().min(1),
});

// GET: List internal notes for a conversation
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { conversationId } = await context.params;
    try {
      const notes = await prisma.internalNote.findMany({
        where: {
          conversationId: conversationId as string,
          conversation: {
            contact: {
              tenantId: tenantId,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ notes });
    } catch (error) {
      console.error("[Notes API] Error fetching notes:", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 }
      );
    }
  }
);

// POST: Create a new internal note
export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId, id: userId }, request, context) => {
    const { conversationId } = await context.params;
    try {
      const conversation = await prisma.crmConversation.findFirst({
        where: {
          id: conversationId as string,
          contact: {
            tenantId: tenantId,
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const body = await request.json();
      const validated = createNoteSchema.parse(body);

      const note = await prisma.internalNote.create({
        data: {
          tenantId,
          conversationId: conversationId as string,
          authorId: userId,
          content: validated.content,
        },
      });

      return NextResponse.json({ note }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 }
        );
      }
      console.error("[Notes API] Error creating note:", error);
      return NextResponse.json(
        { error: "Failed to create note" },
        { status: 500 }
      );
    }
  }
);
