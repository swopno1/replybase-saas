import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const { name, enabled, entryFlow } = body;

    const bot = await db.bot.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(enabled !== undefined && { enabled }),
        ...(entryFlow !== undefined && { entryFlow }),
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("[Admin Bots API] PATCH Error:", error);
    return NextResponse.json(
      { error: "Failed to update bot" },
      { status: 500 },
    );
  }
});

export const DELETE = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    await db.bot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Bots API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to delete bot" },
      { status: 500 },
    );
  }
});
