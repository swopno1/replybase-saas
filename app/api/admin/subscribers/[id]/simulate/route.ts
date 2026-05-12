import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  // Ensure only admins can run simulations
  if (!session?.user?.id || (session.user as any).role !== "ADMIN" && (session.user as any).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: subscriberId } = await context.params;
  const body = await req.json();
  const { message, contactId, channelId, variables, isReset } = body;

  if (isReset) {
    return NextResponse.json({ success: true, message: "Simulation reset" });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: subscriberId },
    include: {
      bots: {
        where: { enabled: true },
        take: 1
      }
    }
  });

  if (!tenant || !tenant.bots[0]) {
    return NextResponse.json({ error: "Subscriber or active bot not found" }, { status: 404 });
  }

  try {
    const result = await executeBotEntryFlowFirst({
      tenantId: tenant.id,
      botId: tenant.bots[0].id,
      contactId: contactId || "sim-contact-id",
      scopeKey: "admin-simulation",
      message: message || "",
      channelId: channelId,
      variables: variables,
      isSimulation: true,
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("[SimulationAPI] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to execute simulation"
    }, { status: 500 });
  }
}
