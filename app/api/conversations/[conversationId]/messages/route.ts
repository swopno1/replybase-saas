import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

const createMessageSchema = z.object({
  content: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]),
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

// GET: List messages for a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const conversation = await getConversation(conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const messages = await prisma.crmMessage.findMany({
        where: { conversationId: conversationId },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ messages });
    } catch (error) {
      console.error("[Messages API] Error fetching messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }
  });
}

// POST: Create a new message in a conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const conversation = await getConversation(conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const body = await req.json();
      const validated = createMessageSchema.parse(body);

      const message = await prisma.crmMessage.create({
        data: {
          conversationId: conversationId,
          content: validated.content,
          direction: validated.direction,
        },
      });

      return NextResponse.json({ message }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 }
        );
      }
      console.error("[Messages API] Error creating message:", error);
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 }
      );
    }
  });
}
