import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { LeadService } from "@/lib/services/lead-service";

export const dynamic = "force-dynamic";

export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const leadService = new LeadService(db as never);
    const result = await leadService.getLeads(tenantId, { status, page, limit });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Leads API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
});

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { ids } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0)) {
      return NextResponse.json(
        { error: "Invalid input: ids must be a non-empty array or 'ALL'" },
        { status: 400 },
      );
    }

    const leadService = new LeadService(db as never);
    const result = await leadService.deleteLeads(tenantId, ids);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Leads API] Batch delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete leads" },
      { status: 500 },
    );
  }
});

export const PATCH: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { ids, status } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0) || !status) {
      return NextResponse.json(
        { error: "Invalid input: ids and status are required" },
        { status: 400 },
      );
    }

    const leadService = new LeadService(db as never);
    const result = await leadService.updateLeadsStatus(tenantId, ids, status);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Leads API] Batch update error:", error);
    return NextResponse.json(
      { error: "Failed to update leads" },
      { status: 500 },
    );
  }
});
