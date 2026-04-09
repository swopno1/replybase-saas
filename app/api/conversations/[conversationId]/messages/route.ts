import { NextRequest, NextResponse } from "next/server";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const createMessageSchema = z.object({
  content: z.string().min(1),
});

// POST: Create a new message (manual reply)
export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
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
          { status: 404 },
        );
      }

      const body = await request.json();
      const validated = createMessageSchema.parse(body);

      const [message] = await prisma.$transaction([
        prisma.crmMessage.create({
          data: {
            conversationId: conversationId as string,
            direction: "outbound",
            content: validated.content,
            source: "human",
          },
        }),
        prisma.crmConversation.update({
          where: { id: conversationId as string },
          data: {
            botPaused:
              conversation.channel === "web" ? true : conversation.botPaused,
            assigneeId: conversation.assigneeId ?? userId,
            status:
              conversation.status === ConversationStatus.CLOSED
                ? ConversationStatus.OPEN
                : conversation.status,
          },
        }),
      ]);

      return NextResponse.json({ message }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 },
        );
      }
      console.error("[Messages API] Error creating message:", error);
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 },
      );
    }
  },
);
