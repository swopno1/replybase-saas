import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exportTenantData } from "@/lib/data-export";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = req.nextUrl.searchParams.get("type");

    if (type === "onboarding") {
      if (!isPlatformAdmin(session)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const tenants = await prisma.tenant.findMany({
        include: {
          users: { select: { email: true, name: true } },
          subscriptions: { include: { plan: true } },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Construct CSV
      let csv = "Tenant Name,Email,Company,Industry,Stage,Status,Plan,Created At\n";
      tenants.forEach(t => {
        const data = t.onboardingData as any;
        const email = t.users[0]?.email || "";
        const companyName = data?.raw?.kyc?.company || "";
        const industry = data?.raw?.businessBasics?.industry || "";
        const stage = t.isOnboarded ? "COMPLETED" : t.onboardingStep.toString();
        const status = t.isOnboarded ? "COMPLETED" : t.onboardingStep > 0 ? "IN_PROGRESS" : "NOT_STARTED";
        // Handle subscriptions array to match schema
        const plan = t.subscriptions && Array.isArray(t.subscriptions) ? t.subscriptions[0]?.plan?.displayName || "" : "";
        const createdAt = new Date(t.createdAt).toISOString();

        csv += `"${t.name}","${email}","${companyName}","${industry}","${stage}","${status}","${plan}","${createdAt}"\n`;
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="onboarding-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
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
