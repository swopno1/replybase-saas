import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

const updateConversationSchema = z.object({
  channel: z.string().min(1).max(50).optional(),
  botId: z.string().cuid().optional(),
});

async function getConversation(conversationId: string, tenantId: string) {
  return await prisma.crmConversation.findFirst({
    where: {
      id: conversationId,
      contact: {
        tenantId: tenantId,
      },
    },
  });
}

// GET: Retrieve a specific conversation
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const conversation = await getConversation(params.conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      return NextResponse.json({ conversation });
    } catch (error) {
      console.error("[Conversations API] Error fetching conversation:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversation" },
        { status: 500 }
      );
    }
  });
}

// PUT: Update a specific conversation
export async function PUT(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const conversation = await getConversation(params.conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const body = await req.json();
      const validated = updateConversationSchema.parse(body);

      const updatedConversation = await prisma.crmConversation.update({
        where: { id: params.conversationId },
        data: {
          channel: validated.channel,
          botId: validated.botId,
        },
      });

      return NextResponse.json({ conversation: updatedConversation });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 }
        );
      }
      console.error("[Conversations API] Error updating conversation:", error);
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }
  });
}

// DELETE: Delete a specific conversation
export async function DELETE(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const conversation = await getConversation(params.conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      await prisma.crmConversation.delete({
        where: { id: params.conversationId },
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error("[Conversations API] Error deleting conversation:", error);
      return NextResponse.json(
        { error: "Failed to delete conversation" },
        { status: 500 }
      );
    }
  });
}
