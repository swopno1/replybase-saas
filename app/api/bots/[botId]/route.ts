import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { checkBotLimit } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(
  async ({ tenantId }, req, context, db) => {
    const { botId } = await context.params;

    const [bot, limitStatus] = await Promise.all([
      db.bot.findFirst({
        where: { id: botId as string },
        include: { channels: true },
      }),
      checkBotLimit(tenantId),
    ]);

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    return NextResponse.json({ bot, limitStatus });
  }
);

export const PATCH = withAuthAndTenant(
  async ({ tenantId }, req, context, db) => {
    const { botId } = await context.params;
    const body = await req.json();
    const { name, enabled, entryFlowId } = body;

    try {
      const bot = await db.bot.update({
        where: { id: botId as string, tenantId },
        data: {
          ...(name && { name }),
          ...(enabled !== undefined && { enabled: Boolean(enabled) }),
          ...(entryFlowId !== undefined && { entryFlow: entryFlowId || null }),
        },
      });

      return NextResponse.json({ bot });
    } catch (error) {
       // Prisma error for not found (P2025)
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json(
          { error: "Bot not found" },
          { status: 404 },
        );
      }
      console.error("[Bots API] Error updating bot:", error);
      return NextResponse.json({ error: "Failed to update bot" }, { status: 500 });
    }
  }
);

export const DELETE = withAuthAndTenant(
  async ({ tenantId }, req, context, db) => {
    const { botId } = await context.params;
    const id = botId as string;

    try {
      await db.$transaction(async (tx) => {
        // Verify ownership
        const bot = await tx.bot.findFirst({
          where: { id, tenantId },
          select: { id: true }
        });

        if (!bot) {
          throw new Error("NOT_FOUND");
        }

        // Note: FacebookPage requires botId (String, not String?), so we delete them.
        await tx.facebookPage.deleteMany({ where: { botId: id, tenantId } });
        await tx.crmConversation.updateMany({ where: { botId: id, tenantId }, data: { botId: null } });
        await tx.executionLog.deleteMany({ where: { botId: id, tenantId } });
        await tx.webChatSite.deleteMany({ where: { botId: id, tenantId } });
        await tx.channel.deleteMany({ where: { botId: id, tenantId } });
        await tx.bot.delete({ where: { id, tenantId } });
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Bot not found" }, { status: 404 });
      }
      console.error("[Bots API] Error deleting bot:", error);
      return NextResponse.json({ error: "Failed to delete bot" }, { status: 500 });
    }
  }
);
