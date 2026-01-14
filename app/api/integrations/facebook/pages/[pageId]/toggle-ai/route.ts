import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
  if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID missing" }, { status: 400 });
    }

    const body = await req.json();
    const { pageId, enabled } = body;

    if (!pageId || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: pageId, enabled" },
        { status: 400 }
      );
    }

    // Verify the page belongs to the user
    const page = await prisma.facebookPage.findFirst({
      where: {
        id: pageId,
        userId: userId,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: "Page not found or access denied" },
        { status: 404 }
      );
    }

    // Update the page's engine connection status
    await prisma.facebookPage.update({
      where: { id: pageId },
      data: {
        engineConnected: enabled,
      },
    });

    return NextResponse.json({
      success: true,
      message: enabled ? "AI enabled for page" : "AI disabled for page",
    });
  } catch (error) {
    console.error("[AI Status API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
