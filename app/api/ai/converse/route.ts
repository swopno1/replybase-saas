import { NextResponse } from "next/server";
import { converse, AiEngineError, ConverseInputSchema } from "@/lib/ai-engine";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';




export const POST = withAuthAndTenant(
  async ({ tenantId, id: userId }, request) => {
    try {
      // Billing Enforcement
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });

      if (!subscription || !subscription.plan) {
        return NextResponse.json({ error: "Subscription required." }, { status: 402 });
      }

      // Check if conversation is new to enforce limit
      const json = await request.json();
      if (!json.conversationId) { // Assuming new conversations don't have an ID yet
        const conversationCount = await prisma.crmConversation.count({
          where: {
            bot: {
              tenantId: tenantId
            }
          }
        });
        if (conversationCount >= subscription.plan.maxConversations) {
          return NextResponse.json({ error: "Conversation limit reached." }, { status: 429 });
        }
      }

      const validation = ConverseInputSchema.safeParse({
        ...json,
        tenantId,
        userId,
      });

      if (!validation.success) {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid request body",
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const responseData = await converse(validation.data);

      return NextResponse.json(responseData);
    } catch (error) {
      if (error instanceof AiEngineError) {
        return NextResponse.json(
          { status: "error", message: error.message },
          { status: 503 }
        );
      }

      console.error("[API] Unhandled error in converse endpoint:", error);
      return NextResponse.json(
        { status: "error", message: "An internal error occurred" },
        { status: 500 }
      );
    }
  }
);
