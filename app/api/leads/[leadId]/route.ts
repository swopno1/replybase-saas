import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateLeadSchema = z.object({
  status: z.string(),
});

export const PATCH: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    try {
      const { leadId } = await context.params;
      const id = String(leadId);

      const lead = await prisma.lead.findFirst({
        where: { id, tenantId },
      });

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      const body = await request.json();
      const validated = updateLeadSchema.parse(body);

      const updatedLead = await prisma.lead.update({
        where: { id },
        data: { status: validated.status },
      });

      return NextResponse.json({ lead: updatedLead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("[Leads API] Error updating lead:", error);
      return NextResponse.json(
        { error: "Failed to update lead" },
        { status: 500 },
      );
    }
  },
);

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
