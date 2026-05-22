import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const plans = await db.plan.findMany({
      select: {
        id: true,
        name: true,
        price: true,
      },
      orderBy: {
        price: "asc",
      },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("[Admin API] Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 },
    );
  }
});
