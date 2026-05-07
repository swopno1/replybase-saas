import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string; pageId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId, pageId } = await params;
  const tenantId = session.user.tenantId;

  try {
    const facebookPage = await prisma.facebookPage.findFirst({
      where: { facebookId: pageId, botId: botId, tenantId: tenantId },
    });

    if (!facebookPage) {
      return NextResponse.json({ error: "Facebook page not found" }, { status: 404 });
    }

    const { enabled } = await req.json();
    const updated = await prisma.facebookPage.update({
      where: { id: facebookPage.id },
      data: { engineConnected: enabled },
    });

    return NextResponse.json({ success: true, engineConnected: updated.engineConnected });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
