import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

const createMessageSchema = z.object({
  content: z.string().min(1),
});

// POST: Create a new message (manual reply)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const conversation = await prisma.crmConversation.findFirst({
        where: {
          id: conversationId,
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

      const body = await req.json();
      const validated = createMessageSchema.parse(body);

      const message = await prisma.crmMessage.create({
        data: {
          conversationId: conversationId,
          direction: "outbound",
          content: validated.content,
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
