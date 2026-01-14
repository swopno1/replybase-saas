import { NextResponse } from "next/server";
import { getTenantExecutionLogs } from "@/lib/execution-logger";
import { withAuthAndTenant } from "@/lib/route-helpers";

// GET: Get execution logs
export const GET = withAuthAndTenant(async (req, _res, context) => {
  try {
    const searchParams = new URL(req.url!).searchParams;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const logs = await getTenantExecutionLogs(context.tenantId, limit, offset);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[Execution Logs API] Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution logs" },
      { status: 500 }
    );
  }
});
