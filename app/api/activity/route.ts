import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID missing" }, { status: 400 });
    }

    // Get user's Facebook pages
    const pages = await prisma.facebookPage.findMany({
      where: { userId },
      select: {
        facebookId: true,
        name: true,
      },
    });

    if (pages.length === 0) {
      return NextResponse.json({ messages: [] });
    }

    const pageIds = pages.map((p: { facebookId: string }) => p.facebookId);
    const pageMap = new Map(pages.map((p: { facebookId: string, name: string }) => [p.facebookId, p.name]));

    // Get last 10 inbound messages
    const messages = await prisma.messageLog.findMany({
      where: {
        direction: "inbound",
        conversation: {
          facebookPageId: {
            in: pageIds,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      select: {
        id: true,
        content: true,
        status: true,
        createdAt: true,
        conversation: {
          select: {
            facebookPageId: true,
          },
        },
      },
    });

    // Enrich with page names
    const enrichedMessages = messages.map((msg: { id: string; content: string; status: string; createdAt: Date; conversation: { facebookPageId: string; }; }) => ({
      id: msg.id,
      content: msg.content,
      status: msg.status,
      createdAt: msg.createdAt,
      pageName: pageMap.get(msg.conversation.facebookPageId) || "Unknown Page",
    }));

    return NextResponse.json({ messages: enrichedMessages });
  } catch (error) {
    console.error("[Activity API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
