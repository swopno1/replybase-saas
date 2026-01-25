import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkBotLimit } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bots = await prisma.bot.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Mock project structure to satisfy frontend expected interface
    const projects = [
      {
        id: 'default',
        name: 'My Bots',
        bots: bots
      }
    ];

    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch bots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Check Limits
  const limitStatus = await checkBotLimit(session.user.tenantId);
  if (!limitStatus.allowed) {
    return NextResponse.json({
      error: "Plan limit reached",
      details: `You have reached the maximum of ${limitStatus.limit} bots on the ${limitStatus.planName} plan. Please upgrade.`
    }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, projectId, channel } = body;

    // Project ID is ignored/mocked for now since we don't have project model
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const bot = await prisma.bot.create({
      data: {
        name,
        // projectId, // Remove projectId assignment
        tenantId: session.user.tenantId,
        enabled: true,
        channels: {
          create: {
            type: channel || "Web",
            name: "Default Channel",
            enabled: true
          }
        }
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("Bot creation error", error);
    return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
  }
}
