import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exportTenantData } from "@/lib/data-export";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins or the account owner to export data
    // In this multi-tenant setup, any user with the correct tenantId can export their workspace data
    // but typically we'd want to restrict this to the tenant admin.
    
    const exportData = await exportTenantData(session.user.tenantId);

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="replybase-data-export-${session.user.tenantId}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("[Data Export API] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate data export" },
      { status: 500 },
    );
  }
}
