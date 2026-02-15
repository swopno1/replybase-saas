import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const POST = withAuthAndTenant(
  async ({ tenantId }, req: NextRequest, context) => {
    try {
      const params = await context.params;
      const body = await req.json();
      const pageId = (params?.pageId as string | undefined) || body?.pageId;
      const { enabled } = body;

      if (!pageId || typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "Missing required fields: pageId, enabled" },
          { status: 400 },
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
          { status: 404 },
        );
      }

      const updateData: { engineConnected: boolean; botId?: string | null } = {
        engineConnected: enabled,
      };

      if (enabled && !page.botId) {
        const defaultBot = await prisma.bot.findFirst({
          where: { tenantId },
          select: { id: true },
        });

        if (!defaultBot) {
          return NextResponse.json(
            { error: "No bot found for this tenant" },
            { status: 400 },
          );
        }

        updateData.botId = defaultBot.id;
      }

      await prisma.facebookPage.update({
        where: { id: pageId },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        message: enabled ? "AI enabled for page" : "AI disabled for page",
      });
    } catch (error) {
      console.error("[Toggle AI Engine API] Error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
);
