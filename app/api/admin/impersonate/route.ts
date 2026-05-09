import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { tenantId } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Set impersonation cookie
    // In a real production app, you might want to sign this cookie or store it in a DB session
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
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    (await cookies()).delete("replybase_impersonation_target");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
