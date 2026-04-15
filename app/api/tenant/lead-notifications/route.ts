import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordMilestoneEvent } from "@/lib/milestone-events";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  emailRecipients: z.array(z.string().trim().email().max(320)).max(20),
  telegramChatIds: z.array(z.string().trim().min(1).max(64)).max(20),
});

function normalizeStringList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

async function getTenantIdFromSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  return user?.tenantId || null;
}

export async function GET() {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.tenantLeadNotificationSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
      select: {
        emailRecipients: true,
        telegramChatIds: true,
      },
    });

    return NextResponse.json({
      emailRecipients: normalizeStringList(
        asStringArray(settings.emailRecipients),
      ),
      telegramChatIds: normalizeStringList(
        asStringArray(settings.telegramChatIds),
      ),
    });
  } catch (error) {
    console.error("[Tenant Lead Notifications API] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load lead notification settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const emailRecipients = normalizeStringList(
      parsed.data.emailRecipients.map((value) => value.toLowerCase()),
    );
    const telegramChatIds = normalizeStringList(parsed.data.telegramChatIds);

    const settings = await prisma.tenantLeadNotificationSettings.upsert({
      where: { tenantId },
      update: {
        emailRecipients,
        telegramChatIds,
      },
      create: {
        tenantId,
        emailRecipients,
        telegramChatIds,
      },
      select: {
        emailRecipients: true,
        telegramChatIds: true,
      },
    });

    if (emailRecipients.length > 0 || telegramChatIds.length > 0) {
      void recordMilestoneEvent(tenantId, "lead-notifications", {
        emailRecipientCount: emailRecipients.length,
        telegramChatIdCount: telegramChatIds.length,
      });
    }

    return NextResponse.json({
      success: true,
      emailRecipients: normalizeStringList(
        asStringArray(settings.emailRecipients),
      ),
      telegramChatIds: normalizeStringList(
        asStringArray(settings.telegramChatIds),
      ),
    });
  } catch (error) {
    console.error("[Tenant Lead Notifications API] PATCH failed:", error);
    return NextResponse.json(
      { error: "Failed to save lead notification settings" },
      { status: 500 },
    );
  }
}
