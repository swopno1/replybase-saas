import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { aiProvider: true, aiApiKey: true },
    });

    return NextResponse.json({
      aiProvider: tenant?.aiProvider,
      hasApiKey: !!tenant?.aiApiKey,
    });
  } catch (error) {
    console.error("[AI Settings GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch AI settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { aiProvider, aiApiKey } = body;

    // Validate provider
    const validProviders = ["gemini", "openai", "anthropic"];
    if (!validProviders.includes(aiProvider)) {
      return NextResponse.json({ error: "Invalid AI provider" }, { status: 400 });
    }

    const data: any = { aiProvider };
    if (aiApiKey !== undefined && aiApiKey !== "********") {
      data.aiApiKey = aiApiKey === "" ? null : aiApiKey;
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data,
    });

    return NextResponse.json({
      aiProvider: updatedTenant.aiProvider,
      message: "AI settings updated successfully",
    });
  } catch (error) {
    console.error("[AI Settings PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update AI settings" }, { status: 500 });
  }
}
