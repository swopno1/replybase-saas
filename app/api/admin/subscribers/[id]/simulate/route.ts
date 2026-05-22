import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { withAdmin } from "@/lib/route-helpers";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { aiFallback } from "@/lib/ai-fallback";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const { message, history, scenarioId } = body;

    let tenantId = id;
    if (id.startsWith("no-sub-")) {
      tenantId = id.replace("no-sub-", "");
    } else {
      const sub = await db.subscription.findUnique({
        where: { id },
        select: { tenantId: true }
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
          take: 1
        },
        subscriptions: {
          include: { plan: true }
        }
      },
    });

    if (!tenant || tenant.bots.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Tenant not found or has no active bots"
      }, { status: 404 });
    }

    const bot = tenant.bots[0];
    const planName = tenant.subscriptions?.plan?.name || "Free";

    const modelMessages = (history || []).map((m: any) => ({
      role: m.role,
      content: m.text
    }));

    // 1. Try Flow Engine
    const result = await executeBotEntryFlowFirst({
      tenantId: tenant.id,
      botId: bot.id,
      userId: "admin-simulator",
      message: message || "",
      metadata: {
        isAdminSimulation: true,
        scenarioId
      }
    });

    let finalResult: any = result;

    // 2. If no flow result, fallback to AI
    if (!result) {
      const aiResponseText = await aiFallback({
        tenantId: tenant.id,
        botId: bot.id,
        message: message || "Hello",
        history: modelMessages,
        planName
      });

      finalResult = {
        responses: [{
          type: "text" as const,
          text: aiResponseText || "No response generated.",
          quickReplies: [],
        }],
        variables: {},
        shouldFallbackToAi: true
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
      ...finalResult
    });
  } catch (error: any) {
    console.error("[SimulationAPI] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to execute simulation"
    }, { status: 500 });
  }
});
