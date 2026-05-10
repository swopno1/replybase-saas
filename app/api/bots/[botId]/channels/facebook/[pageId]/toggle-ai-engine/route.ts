import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  const { botId, pageId } = (await context.params) as { botId: string; pageId: string };

  try {
    const facebookPage = await db.facebookPage.findFirst({
      where: { facebookId: pageId, botId: botId, tenantId: tenantId },
    });

    if (!facebookPage) {
      return NextResponse.json({ error: "Facebook page not found" }, { status: 404 });
    }

    const { enabled, flowId } = await req.json();

    // 1. Update the engine connection status on the page
    const updated = await db.facebookPage.update({
      where: { id: facebookPage.id },
      data: { engineConnected: enabled },
    });

    // 2. Manage the FlowAssignment
    if (enabled && flowId) {
      // Create or update the assignment
      await db.flowAssignment.upsert({
        where: { pageId: facebookPage.id },
        update: { flowId, isActive: true },
        create: {
          pageId: facebookPage.id,
          flowId,
          isActive: true,
        },
      });
    } else if (!enabled) {
      // Deactivate the assignment if engine is disabled
      await db.flowAssignment.updateMany({
        where: { pageId: facebookPage.id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({
      success: true,
      engineConnected: updated.engineConnected,
      flowId: enabled ? flowId : null,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
