import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const GET = withAuthAndTenant(
  async () => {
    try {
      const healthStatus = await prisma.systemHealth.findMany();
      return NextResponse.json(healthStatus);
    } catch (error) {
      console.error("[System Health API] Error fetching status:", error);
      return NextResponse.json(
        { error: "Failed to fetch system health status" },
        { status: 500 }
      );
    }
  }
);
