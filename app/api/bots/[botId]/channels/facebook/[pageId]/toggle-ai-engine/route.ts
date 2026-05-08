import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; pageId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId, pageId } = await params;
  const tenantId = session.user.tenantId;

  try {
    const facebookPage = await prisma.facebookPage.findFirst({
      where: { facebookId: pageId, botId: botId, tenantId: tenantId },
    });

    if (!facebookPage) {
      return NextResponse.json({ error: "Facebook page not found" }, { status: 404 });
    }

    const { enabled, flowId } = await req.json();

    // 1. Update the engine connection status on the page
    const updated = await prisma.facebookPage.update({
      where: { id: facebookPage.id },
      data: { engineConnected: enabled },
    });

    // 2. Manage the FlowAssignment
    if (enabled && flowId) {
      // Create or update the assignment
      await prisma.flowAssignment.upsert({
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
      await prisma.flowAssignment.updateMany({
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
}
