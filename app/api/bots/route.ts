import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canCreateBot } from "@/lib/subscription";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

const createBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  entryFlow: z.string().optional(),
  welcomeMessage: z.string().max(1000).optional(),
  triggers: z.array(z.string()).default([]),
});

// GET: List user's bots
export const GET = withAuthAndTenant(async (_req, res, context) => {
  try {
    const bots = await prisma.bot.findMany({
      where: { tenantId: context.tenantId },
      include: {
        channels: {
          select: {
            id: true,
            type: true,
            enabled: true,
            killSwitch: true,
            channelId: true,
          },
        },
        _count: {
          select: {
            channels: true,
            executionLogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bots });
  } catch (error) {
    console.error("[Bots API] Error fetching bots:", error);
    return NextResponse.json(
      { error: "Failed to fetch bots" },
      { status: 500 }
    );
  }
});

// POST: Create a new bot
export const POST = withAuthAndTenant(async (req, res, context) => {
  try {
    // Check if user can create more bots
    const canCreate = await canCreateBot(context.session.user.id);
    if (!canCreate) {
      return NextResponse.json(
        { error: "Bot limit reached. Please upgrade your plan." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createBotSchema.parse(body);

    const bot = await prisma.bot.create({
      data: {
        tenantId: context.tenantId,
        userId: context.session.user.id,
        name: validated.name,
        description: validated.description || null,
        entryFlow: validated.entryFlow || null,
        welcomeMessage: validated.welcomeMessage || null,
        triggers: validated.triggers,
        enabled: true,
      },
      include: {
        channels: true,
      },
    });

    return NextResponse.json({ bot }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("[Bots API] Error creating bot:", error);
    return NextResponse.json(
      { error: "Failed to create bot" },
      { status: 500 }
    );
  }
});
