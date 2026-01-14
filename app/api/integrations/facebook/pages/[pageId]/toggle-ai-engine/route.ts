import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const POST = withAuthAndTenant(
  async ({ tenantId }, req: Request) => {
    try {
      const body = await req.json();
      const { pageId, enabled } = body;

      if (!pageId || typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "Missing required fields: pageId, enabled" },
          { status: 400 }
        );
      }

      // Verify the page belongs to the tenant
      const page = await prisma.facebookPage.findFirst({
        where: {
          id: pageId,
          tenantId: tenantId,
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
      console.error("[Toggle AI Engine API] Error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);
