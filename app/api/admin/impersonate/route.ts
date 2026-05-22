import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withAdmin } from "@/lib/route-helpers";

export const POST = withAdmin(async (session, request) => {
  try {
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    (await cookies()).set("replybase_impersonation_target", tenantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2, // 2 hours
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Impersonation API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const DELETE = withAdmin(async () => {
  try {
    (await cookies()).delete("replybase_impersonation_target");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
