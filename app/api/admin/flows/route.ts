import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const body = await request.json();
    const { tenantId, name, description } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Create flow
    const flow = await db.flow.create({
      data: {
        name: name || "New Admin-Created Flow",
        description: description || "Created by platform administrator",
        tenantId,
        isActive: false,
        nodes: {
          create: [
            {
              type: "message",
              content: { text: "Hello! How can I help you today?" },
              order: 0,
            },
          ],
        },
      },
    });

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("[Admin Flows API] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create flow" },
      { status: 500 },
    );
  }
});
