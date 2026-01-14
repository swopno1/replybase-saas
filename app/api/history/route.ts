import { NextRequest, NextResponse } from "next/server";
import { getTenantExecutionLogs } from "@/lib/execution-logger";
import { withAuthAndTenant } from "@/lib/route-helpers";

// GET: Get execution logs
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    try {
      const searchParams = new URL(request.url!).searchParams;
      const limit = parseInt(searchParams.get("limit") || "100");
      const offset = parseInt(searchParams.get("offset") || "0");

      const logs = await getTenantExecutionLogs(tenantId, limit, offset);

      return NextResponse.json({ logs });
    } catch (error) {
      console.error("[Execution Logs API] Error fetching logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch execution logs" },
        { status: 500 }
      );
    }
  }
);
