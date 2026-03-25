import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {

  getWebchatRolloutConfig,
  updateWebchatRolloutConfig,
  type WebchatRolloutMode,
} from "@/lib/webchat-rollout";

export const dynamic = 'force-dynamic';



const ADMIN_EMAIL = "amirhossain.limon@gmail.com";

const updateSchema = z.object({
  mode: z.enum(["off", "pilot", "tiered", "ga"]),
  enabledTenantIds: z.array(z.string()).default([]),
  disabledTenantIds: z.array(z.string()).default([]),
  pilotTenantIds: z.array(z.string()).default([]),
  allowedPlanNames: z.array(z.string()).default([]),
});

function normalizeList(values: string[]) {
  return Array.from(
    new Set(values.map((entry) => entry.trim()).filter(Boolean)),
  );
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ config: getWebchatRolloutConfig() });
  } catch (error) {
    console.error("[Admin API] Error fetching webchat rollout config:", error);
    return NextResponse.json(
      { error: "Failed to fetch rollout config" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const config = updateWebchatRolloutConfig({
      mode: parsed.data.mode as WebchatRolloutMode,
      enabledTenantIds: normalizeList(parsed.data.enabledTenantIds),
      disabledTenantIds: normalizeList(parsed.data.disabledTenantIds),
      pilotTenantIds: normalizeList(parsed.data.pilotTenantIds),
      allowedPlanNames: normalizeList(parsed.data.allowedPlanNames),
    });

    return NextResponse.json({
      config,
      note: "Runtime rollout config updated. Persist to deployment env for durability.",
    });
  } catch (error) {
    console.error("[Admin API] Error updating webchat rollout config:", error);
    return NextResponse.json(
      { error: "Failed to update rollout config" },
      { status: 500 },
    );
  }
}
