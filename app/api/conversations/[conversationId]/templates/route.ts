import { NextRequest, NextResponse } from "next/server";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { deliverConversationTemplate } from "@/lib/conversation-channel-delivery";

export const dynamic = "force-dynamic";

const templateParameterSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
});

const templateComponentSchema = z.object({
  type: z.enum(["header", "body", "button"]),
  sub_type: z.enum(["quick_reply", "url"]).optional(),
  index: z.number().optional(),
  parameters: z.array(templateParameterSchema).optional(),
});

const sendTemplateSchema = z.object({
  templateName: z.string().min(1),
  languageCode: z.string().min(1).default("en_US"),
  components: z.array(templateComponentSchema).optional(),
});

// POST /api/conversations/[conversationId]/templates
// Sends a WhatsApp template message. Bypasses the 24-hour customer service window,
// enabling both proactive outreach and re-engagement of lapsed conversations.
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
          contact: { tenantId },
        },
        include: {
          contact: {
            select: {
              phone: true,
              identities: { select: { type: true, value: true } },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      if (conversation.channel !== "whatsapp") {
        return NextResponse.json(
          { error: "Template messages are only supported on WhatsApp conversations." },
          { status: 400 },
        );
      }

      const body = await request.json();
      const validated = sendTemplateSchema.parse(body);

      const deliveryResult = await deliverConversationTemplate({
        conversation: {
          id: conversation.id,
          channel: conversation.channel,
          botId: conversation.botId,
          contact: {
            phone: conversation.contact.phone,
            identities: conversation.contact.identities,
          },
        },
        templateName: validated.templateName,
        languageCode: validated.languageCode,
        components: validated.components,
      });

      if (!deliveryResult.success) {
        return NextResponse.json(
          { error: deliveryResult.message, code: deliveryResult.code },
          { status: 422 },
        );
      }

      // Build a human-readable preview for the message record
      const bodyComponent = validated.components?.find((c) => c.type === "body");
      const paramValues = bodyComponent?.parameters?.map((p) => p.text).join(", ");
      const messageContent = paramValues
        ? `[Template: ${validated.templateName}] ${paramValues}`
        : `[Template: ${validated.templateName}]`;

      const [message] = await prisma.$transaction([
        prisma.crmMessage.create({
          data: {
            tenantId,
            conversationId: conversationId as string,
            direction: "outbound",
            content: messageContent,
            source: "template",
          },
        }),
        prisma.crmConversation.update({
          where: { id: conversationId as string },
          data: {
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
      console.error("[Templates API] Error sending template:", error);
      return NextResponse.json({ error: "Failed to send template message" }, { status: 500 });
    }
  },
);
