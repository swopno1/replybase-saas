import { NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { withAdmin } from "@/lib/route-helpers";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import type { FlowResponse } from "@/lib/bot-entry-flow-engine";
import { aiFallback } from "@/lib/ai-fallback";
import type { ModelMessage } from "ai";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };
    const body = (await request.json()) as {
      message?: string;
      history?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      scenarioId?: string;
    };
    const { message, history, scenarioId } = body;

    let tenantId = id;
    if (id.startsWith("no-sub-")) {
      tenantId = id.replace("no-sub-", "");
    } else {
      const sub = await db.subscription.findUnique({
        where: { id },
        select: { tenantId: true },
      });
      if (sub) {
        tenantId = sub.tenantId;
      }
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        bots: {
          where: { enabled: true },
          take: 1,
        },
        subscriptions: {
          include: { plan: true },
        },
      },
    });

    if (!tenant || tenant.bots.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tenant not found or has no active bots",
        },
        { status: 404 },
      );
    }

    const bot = tenant.bots[0];
    const planName = tenant.subscriptions?.plan?.name || "Free";

    const modelMessages = (history || []).map((m) => ({
      role: m.role,
      content: m.text,
    })) as ModelMessage[];

    const simulationContact =
      (await db.contact.findFirst({
        where: { tenantId: tenant.id },
        select: { id: true },
      })) ||
      (await db.contact.create({
        data: {
          tenantId: tenant.id,
          name: "Simulation Contact",
        },
      }));

    type SimulationFallbackResult = {
      responses: FlowResponse[];
      variables: Record<string, unknown>;
      shouldFallbackToAi: true;
    };

    type SimulationResult =
      | Awaited<ReturnType<typeof executeBotEntryFlowFirst>>
      | SimulationFallbackResult;

    // 1. Try Flow Engine
    const result = await executeBotEntryFlowFirst({
      isSimulation: true,
      tenantId: tenant.id,
      botId: bot.id,
      contactId: simulationContact.id,
      scopeKey: `admin-simulation:${tenant.id}`,
      message: message || "",
      entryFlow: bot.entryFlow ?? undefined,
      variables: {
        isAdminSimulation: true,
        scenarioId,
      },
    });

    let finalResult: SimulationResult = result;

    // 2. If no flow result, fallback to AI
    if (!result) {
      const aiResponse = await aiFallback({
        botId: bot.id,
        conversationId: simulationContact.id,
        messages: modelMessages,
        planName,
        isSimulation: true,
      });
      const aiResponseText =
        typeof aiResponse === "string" ? aiResponse : await aiResponse.text;

      finalResult = {
        responses: [
          {
            type: "text" as const,
            text: aiResponseText || "No response generated.",
            quickReplies: [],
          },
        ],
        variables: {},
        shouldFallbackToAi: true,
      };
    }

    // 3. Log Admin Activity
    await logAdminActivity({
      adminId: session.user.id,
      action: "SIMULATION_RUN",
      entityType: "subscriber",
      entityId: tenant.id,
      description: `Ran sandbox simulation for subscriber: ${tenant.name} using scenario: ${scenarioId || "manual"}`,
      metadata: {
        scenarioId,
        messageCount: modelMessages.length,
        hasFlowResult: !!result,
        shouldFallbackToAi: !result,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      ...finalResult,
    });
  } catch (error) {
    console.error("[SimulationAPI] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute simulation",
      },
      { status: 500 },
    );
  }
});
