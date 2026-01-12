import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { canCreateBot } from "@/lib/subscription";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

const createBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  entryFlow: z.string().optional(),
  welcomeMessage: z.string().max(1000).optional(),
  triggers: z.array(z.string()).default([]),
});

// GET: List user's bots
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const bots = await prisma.bot.findMany({
      where: { tenantId: user.tenantId },
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
}

// POST: Create a new bot
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    // Check if user can create more bots
    const canCreate = await canCreateBot(session.user.id);
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
        tenantId: user.tenantId,
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
}
