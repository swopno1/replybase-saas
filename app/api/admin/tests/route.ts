import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { recordActivity } from "@/lib/activity-log";
import { getAiModel, type AiProvider, type AiTask } from "@/lib/ai-service";
import { generateText } from "ai";
import { withAdmin } from "@/lib/route-helpers";

export const GET = withAdmin(async (session, request, context, db) => {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const results = await db.testHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (format === "csv") {
    const headers = "ID,Type,Name,Status,Duration,Date\n";
    const escapeCsv = (str: unknown) => {
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const csv = results.map(r =>
      `${escapeCsv(r.id)},${escapeCsv(r.type)},${escapeCsv(r.name)},${escapeCsv(r.status)},${r.duration},${r.createdAt.toISOString()}`
    ).join("\n");

    return new NextResponse(headers + csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="test-results.csv"',
      },
    });
  }

  return NextResponse.json(results);
});

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { type, name, provider, task, prompt } = await request.json();

    // --- AI DIAGNOSTIC TEST ---
    if (type === "ai") {
      try {
        const start = Date.now();
        const model = getAiModel({
          provider: (provider as AiProvider) || "default",
          task: (task as AiTask) || "chat",
        });

        const result = await generateText({
          model,
          prompt: prompt || "Say 'AI Connectivity Verified'",
          max_tokens: 50,
        } as any);

        const duration = Date.now() - start;

        const record = await db.testHistory.create({
          data: {
            type: "ai_diagnostic",
            name: name || `AI Diagnostic (${provider || "default"})`,
            status: "passed",
            duration: duration,
            output: JSON.stringify({
              provider,
              task,
              text: result.text,
              usage: result.usage,
            }),
          },
        });

        return NextResponse.json(record);
      } catch (e: any) {
        console.error("[AdminAiTest] Diagnostic Error:", e);
        const record = await db.testHistory.create({
          data: {
            type: "ai_diagnostic",
            name: name || "AI Diagnostic Failed",
            status: "failed",
            duration: 0,
            output: JSON.stringify({
              error: e.message,
              name: e.name,
              cause: e.cause,
              stack: e.stack,
              url: e.url,
            }),
          },
        });
        return NextResponse.json(record, { status: 500 });
      }
    }

    // --- SMOKE TEST ---
    if (type === "smoke") {
      const start = Date.now();
      try {
        // 1. DB Check
        await db.$queryRaw`SELECT 1`;

        const result = await db.testHistory.create({
          data: {
            type: "smoke",
            name: name || "System Health Check",
            status: "passed",
            duration: Date.now() - start,
            output: "All systems operational. DB connectivity verified.",
          },
        });
        return NextResponse.json(result);
      } catch (e) {
        await recordActivity({
          tenantId: session.user.tenantId,
          userId: session.user.id,
          type: "SYSTEM_HEALTH_FAILURE",
          title: "System Health Check Failed",
          description: `Manual health check failed: ${String(e)}`,
          metadata: { error: String(e) }
        });

        return NextResponse.json({ error: String(e) }, { status: 500 });
      }
    }

    // --- LOAD TEST ---
    const allowProductionLoad = process.env.ALLOW_PRODUCTION_LOAD_TESTS === "true";
    const isProduction = process.env.NODE_ENV === "production";

    if (type === "load") {
      if (isProduction && !allowProductionLoad) {
          return NextResponse.json({
              error: "Load tests are disabled in production. Set ALLOW_PRODUCTION_LOAD_TESTS=true to enable."
          }, { status: 403 });
      }

      execFile("pnpm", ["tsx", "scripts/run-load-tests.ts"], async (error) => {
          if (error) {
            console.error("Admin triggered load test failed", error);
            await recordActivity({
              tenantId: session.user.tenantId,
              userId: session.user.id,
              type: "LOAD_TEST_FAILURE",
              title: "Load Test Execution Failed",
              description: `A background load test failed to start or complete: ${error.message}`,
            });
          }
      });
      return NextResponse.json({ message: "Load test triggered" });
    }

    return new NextResponse("Invalid test type", { status: 400 });
  } catch (error) {
    console.error("[Admin Tests API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
