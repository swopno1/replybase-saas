import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const body = await request.json();
    const { tenantId, name } = body;

    if (!tenantId || !name) {
      return NextResponse.json({ error: "Tenant ID and name are required" }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Create bot
    const bot = await db.bot.create({
      data: {
        name,
        tenantId,
        enabled: true,
        channels: {
          create: {
            tenantId,
            type: "web",
            name: "Webchat Channel",
            enabled: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("[Admin Bots API] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create bot" },
      { status: 500 },
    );
  }
});
