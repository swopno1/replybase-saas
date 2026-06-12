import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateLeadSchema = z.object({
  status: z.string(),
});

export const PATCH = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    try {
      const { leadId } = await context.params;
      const id = String(leadId);

      const body = await request.json();
      const validated = updateLeadSchema.parse(body);

      const updatedLead = await db.lead.update({
        where: { id, tenantId },
        data: { status: validated.status },
      });

      import("@/lib/services/webhook-dispatcher").then(({ dispatchWebhook }) =>
        dispatchWebhook(tenantId, "lead.updated", {
          id: updatedLead.id,
          status: updatedLead.status,
          name: updatedLead.name,
        })
      ).catch(() => {});

      return NextResponse.json({ lead: updatedLead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      // Prisma error for not found (P2025)
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 },
        );
      }
      console.error("[Leads API] Error updating lead:", error);
      return NextResponse.json(
        { error: "Failed to update lead" },
        { status: 500 },
      );
    }
  },
);

export const DELETE = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    try {
      const { leadId } = await context.params;
      const id = String(leadId);

      await db.lead.delete({
        where: { id, tenantId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      // Prisma error for not found (P2025)
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 },
        );
      }
      console.error("[Leads API] Error deleting lead:", error);
      return NextResponse.json(
        { error: "Failed to delete lead" },
        { status: 500 },
      );
    }
  },
);
