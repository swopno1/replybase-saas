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
    const projects = await prisma.project.findMany({
      where: {
        tenantId: session.user.tenantId,
      },
      include: {
        bots: true,
      },
    });

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

    if (!name || !projectId) {
      return NextResponse.json({ error: "Name and Project ID are required" }, { status: 400 });
    }

    const bot = await prisma.bot.create({
      data: {
        name,
        channel: channel || "Web",
        projectId,
        tenantId: session.user.tenantId,
        status: true
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create bot" }, { status: 500 });
  }
}
