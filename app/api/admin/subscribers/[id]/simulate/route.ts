import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { prisma } from "@/lib/prisma";
import { aiFallback } from "@/lib/ai-fallback";
import { logAdminActivity } from "@/lib/admin-audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  // Ensure only admins can run simulations
  if (!session?.user?.id || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "SUPERADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: subscriberId } = await context.params;
  const body = await req.json();
  const { message, contactId, channelId, variables, isReset, history, scenarioId } = body;

  if (isReset) {
    return NextResponse.json({ success: true, message: "Simulation reset" });
  }

  let tenantId = subscriberId;
  if (subscriberId.startsWith("no-sub-")) {
    tenantId = subscriberId.replace("no-sub-", "");
  } else {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriberId },
      select: { tenantId: true }
    });
    if (sub) {
      tenantId = sub.tenantId;
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      bots: {
        where: { enabled: true },
        take: 1
      },
      subscriptions: {
        include: { plan: true }
      }
    }
  });

  if (!tenant || !tenant.bots[0]) {
    return NextResponse.json({ error: "Subscriber or active bot not found" }, { status: 404 });
  }

  try {
    // 1. Prepare history for AI Fallback
    let modelMessages = (history || []).map((m: any) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    if (message && (modelMessages.length === 0 || modelMessages[modelMessages.length - 1].content !== message)) {
      modelMessages.push({ role: "user", content: message });
    }

    // 2. Execute primary entry flow runtime
    const result = await executeBotEntryFlowFirst({
      tenantId: tenant.id,
      botId: tenant.bots[0].id,
      contactId: contactId || "sim-contact-id",
      scopeKey: "admin-simulation",
      message: message || "",
      channelId: channelId,
      variables: variables,
      isSimulation: true,
      entryFlow: tenant.bots[0].entryFlow ?? undefined,
    });

    let finalResult = result;

    if (!finalResult) {
      // Direct fallback to AI when no flow resolves
      const aiResponseStreamOrString = await aiFallback({
        botId: tenant.bots[0].id,
        conversationId: "sim-conv-id",
        messages: modelMessages,
        planName: tenant.subscriptions?.plan?.name || "Free",
        isSimulation: true,
      });

      let aiResponseText = "";
      if (typeof aiResponseStreamOrString === "string") {
        aiResponseText = aiResponseStreamOrString;
      } else if (aiResponseStreamOrString && typeof aiResponseStreamOrString === "object" && "text" in aiResponseStreamOrString) {
        aiResponseText = await aiResponseStreamOrString.text;
      }

      finalResult = {
        handled: true,
        responses: [{
          type: "text",
          text: aiResponseText || "No response generated.",
          quickReplies: [],
        }],
        flowId: "ai-fallback",
        flowName: "AI Fallback",
        flowSessionId: "sim-session-id",
        completed: true,
        waitingForInput: false,
        shouldFallbackToAi: true,
        fallbackMessage: null,
        executionTrace: [{
          nodeId: "ai-fallback",
          type: "ai-fallback",
          status: "success" as const,
          variablesBefore: variables || {},
          variablesAfter: variables || {},
          responses: [{ type: "text", text: aiResponseText || "No response generated." }],
        }],
        variables: variables || {},
      };
    } else if (finalResult.shouldFallbackToAi || !finalResult.responses || finalResult.responses.length === 0) {
      // Flow completed or fell back, execute AI fallback
      const aiResponseStreamOrString = await aiFallback({
        botId: tenant.bots[0].id,
        conversationId: "sim-conv-id",
        messages: modelMessages,
        planName: tenant.subscriptions?.plan?.name || "Free",
        isSimulation: true,
      });

      let aiResponseText = "";
      if (typeof aiResponseStreamOrString === "string") {
        aiResponseText = aiResponseStreamOrString;
      } else if (aiResponseStreamOrString && typeof aiResponseStreamOrString === "object" && "text" in aiResponseStreamOrString) {
        aiResponseText = await aiResponseStreamOrString.text;
      }

      finalResult.responses = finalResult.responses || [];
      finalResult.responses.push({
        type: "text" as const,
        text: aiResponseText || "No response generated.",
        quickReplies: [],
      });

      finalResult.shouldFallbackToAi = true;

      if (finalResult.executionTrace) {
        finalResult.executionTrace.push({
          nodeId: "ai-fallback",
          type: "ai-fallback",
          status: "success" as const,
          variablesBefore: { ...finalResult.variables },
          variablesAfter: { ...finalResult.variables },
          responses: [{ type: "text", text: aiResponseText || "No response generated." }],
        });
      }
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
        shouldFallbackToAi: finalResult.shouldFallbackToAi,
      },
    });

    return NextResponse.json({
      success: true,
      ...finalResult
    });
  } catch (error: any) {
    console.error("[SimulationAPI] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to execute simulation"
    }, { status: 500 });
  }
}
