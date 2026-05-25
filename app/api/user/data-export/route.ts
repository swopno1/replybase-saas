import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant, withAdmin } from "@/lib/route-helpers";
import { exportTenantData } from "@/lib/data-export";

export const GET = async (req: NextRequest, context: any) => {
  const type = req.nextUrl.searchParams.get("type");

  if (type === "onboarding") {
    return withAdmin(async (session, request, ctx, db) => {
      const tenants = await db.tenant.findMany({
        include: {
          users: { select: { email: true, name: true } },
          subscriptions: { include: { plan: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      let csv = "Tenant Name,Email,Company,Industry,Stage,Status,Plan,Created At\n";
      tenants.forEach(t => {
        const data = t.onboardingData as any;
        const email = t.users[0]?.email || "";
        const companyName = data?.raw?.business?.company || data?.raw?.kyc?.company || "";
        const industry = data?.raw?.business?.industry || data?.raw?.businessBasics?.industry || "";
        const stage = t.isOnboarded ? "COMPLETED" : t.onboardingStep.toString();
        const status = t.isOnboarded ? "COMPLETED" : t.onboardingStep > 0 ? "IN_PROGRESS" : "NOT_STARTED";
        const plan = (t.subscriptions && Array.isArray(t.subscriptions)) ? t.subscriptions[0]?.plan?.displayName || "" : "";
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
    })(req, context);
  }

  return withAuthAndTenant(async (user, request, ctx, db) => {
    try {
      const exportData = await exportTenantData(user.tenantId);
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="replybase-data-export-${user.tenantId}-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    } catch (error) {
      console.error("[Data Export API] Error:", error);
      return NextResponse.json({ error: "Failed to generate data export" }, { status: 500 });
    }
  })(req, context);
};
