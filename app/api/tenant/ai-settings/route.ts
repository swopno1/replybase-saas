import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const GET = withAuthAndTenant(async (user, req, ctx, db) => {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { aiProvider: true, aiApiKey: true, aiModel: true },
    });

    return NextResponse.json({
      aiProvider: tenant?.aiProvider || "default",
      aiModel: tenant?.aiModel,
      hasApiKey: !!tenant?.aiApiKey,
    });
  } catch (error) {
    console.error("[AI Settings GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch AI settings" }, { status: 500 });
  }
});

export const PATCH = withAuthAndTenant(async (user, req, ctx, db) => {
  try {
    const body = await req.json();
    const { aiProvider, aiApiKey, aiModel } = body;

    // Validate provider
    const validProviders = ["default", "gemini", "openai", "anthropic", "digitalocean"];
    if (!validProviders.includes(aiProvider)) {
      return NextResponse.json(
        { error: "Invalid AI provider" },
        { status: 400 },
      );
    }

    const data: any = {
      aiProvider,
      aiModel: aiProvider === "default" ? null : aiModel || null,
    };

    if (aiProvider === "default") {
      data.aiApiKey = null;
    } else if (aiApiKey !== undefined && aiApiKey !== "********") {
      data.aiApiKey = aiApiKey === "" ? null : aiApiKey;
    }

    const updatedTenant = await db.tenant.update({
      where: { id: user.tenantId },
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
});
