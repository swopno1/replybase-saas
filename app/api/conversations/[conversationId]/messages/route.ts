import { NextRequest, NextResponse } from "next/server";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { deliverConversationMessage } from "@/lib/conversation-channel-delivery";

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
        include: {
          contact: {
            select: {
              phone: true,
              identities: {
                select: {
                  type: true,
                  value: true,
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

      const body = await request.json();
      const validated = createMessageSchema.parse(body);

      const deliveryResult = await deliverConversationMessage({
        conversation: {
          id: conversation.id,
          channel: conversation.channel,
          botId: conversation.botId,
          metadata: conversation.metadata,
          contact: {
            phone: conversation.contact.phone,
            identities: conversation.contact.identities,
          },
        },
        content: validated.content,
      });

      if (!deliveryResult.success) {
        return NextResponse.json(
          {
            error: deliveryResult.message,
            code: deliveryResult.code,
          },
          {
            status: deliveryResult.code === "outside_window" ? 409 : 422,
          },
        );
      }

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
              conversation.channel === "web" || conversation.channel === "facebook"
                ? true
                : conversation.botPaused,
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
