import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    try {
      const { leadId } = await context.params;
      const id = String(leadId);

      const lead = await prisma.lead.findFirst({
        where: {
          id,
          tenantId,
        },
        select: {
          id: true,
        },
      });

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      await prisma.lead.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[Leads API] Error deleting lead:", error);
      return NextResponse.json(
        { error: "Failed to delete lead" },
        { status: 500 },
      );
    }
  },
);
