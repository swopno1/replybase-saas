import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const DELETE = withAuthAndTenant(async (user, req, ctx, db) => {
  const { id } = await ctx.params;

  try {
    await db.apiKey.delete({
      where: { id: id as string },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
});
