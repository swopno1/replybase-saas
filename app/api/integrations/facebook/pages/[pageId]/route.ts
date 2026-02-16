import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });
  }

  const { pageId } = await params;
  if (!pageId) {
    return NextResponse.json({ error: "Page ID is required" }, { status: 400 });
  }

  try {
    // Find the Facebook page to verify it belongs to this tenant
    const facebookPage = await prisma.facebookPage.findFirst({
      where: {
        facebookId: pageId,
        tenantId: tenantId,
      },
    });

    if (!facebookPage) {
      return NextResponse.json(
        { error: "Facebook page not found" },
        { status: 404 },
      );
    }

    // Delete the Facebook page from database
    await prisma.facebookPage.delete({
      where: {
        id: facebookPage.id,
      },
    });

    console.log(
      `[Facebook Integration] Page ${pageId} unlinked for tenant ${tenantId}`,
    );

    return NextResponse.json({
      success: true,
      message: "Page unlinked successfully",
    });
  } catch (error) {
    console.error("[Facebook Integration] Error unlinking page:", error);
    return NextResponse.json(
      {
        error: "Failed to unlink page",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
