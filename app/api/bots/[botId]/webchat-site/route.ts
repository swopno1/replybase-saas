import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateWebChatSite,
  normalizeAllowedDomains,
  rotateWebChatSiteCredentials,
} from "@/lib/webchat";

const updateSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).optional(),
  allowedDomains: z.array(z.string()).optional(),
  themeConfig: z.record(z.string(), z.unknown()).optional(),
  rotatePublicKey: z.boolean().optional(),
  rotateSecretKey: z.boolean().optional(),
});

function serializeSite(site: {
  id: string;
  name: string;
  publicKey: string;
  secretKey: string;
  allowedDomains: Prisma.JsonValue;
  themeConfig: Prisma.JsonValue;
  channelId: string | null;
  isActive: boolean;
}) {
  return {
    id: site.id,
    name: site.name,
    publicKey: site.publicKey,
    secretKey: site.secretKey,
    allowedDomains: Array.isArray(site.allowedDomains)
      ? site.allowedDomains.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    themeConfig:
      (site.themeConfig as Prisma.JsonObject | null) ||
      ({} as Prisma.JsonObject),
    channelId: site.channelId,
    isActive: site.isActive,
  };
}

async function getTenantBot(botId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return {
      error: NextResponse.json({ error: "No tenant found" }, { status: 403 }),
    };
  }

  const bot = await prisma.bot.findFirst({
    where: {
      id: botId,
      tenantId: user.tenantId,
    },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!bot) {
    return {
      error: NextResponse.json({ error: "Bot not found" }, { status: 404 }),
    };
  }

  return { bot };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;
    const authResult = await getTenantBot(botId, session.user.id);
    if (authResult.error) {
      return authResult.error;
    }

    const channelId = request.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "web",
      },
      select: {
        id: true,
        name: true,
        botId: true,
        bot: {
          select: {
            tenantId: true,
          },
        },
        config: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Web channel not found" },
        { status: 404 },
      );
    }

    const site = await getOrCreateWebChatSite({
      channelId: channel.id,
      botId: channel.botId,
      tenantId: channel.bot.tenantId,
      name: channel.name,
      themeConfig: (channel.config as Prisma.JsonObject | null) || {},
    });

    return NextResponse.json({ site: serializeSite(site) });
  } catch (error) {
    console.error("[Webchat Site API] Failed to load site:", error);
    return NextResponse.json(
      { error: "Failed to load webchat site" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;
    const authResult = await getTenantBot(botId, session.user.id);
    if (authResult.error) {
      return authResult.error;
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const normalizedAllowedDomains = parsed.data.allowedDomains
      ? normalizeAllowedDomains(parsed.data.allowedDomains)
      : undefined;

    if (
      parsed.data.allowedDomains &&
      parsed.data.allowedDomains.length > 0 &&
      normalizedAllowedDomains?.length === 0
    ) {
      return NextResponse.json(
        { error: "Allowed domains must contain at least one valid origin" },
        { status: 400 },
      );
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: parsed.data.channelId,
        botId,
        type: "web",
      },
      select: {
        id: true,
        name: true,
        botId: true,
        bot: {
          select: {
            tenantId: true,
          },
        },
        config: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Web channel not found" },
        { status: 404 },
      );
    }

    const site = await getOrCreateWebChatSite({
      channelId: channel.id,
      botId: channel.botId,
      tenantId: channel.bot.tenantId,
      name: channel.name,
      themeConfig: (channel.config as Prisma.JsonObject | null) || {},
    });

    const updatedSite = await prisma.webChatSite.update({
      where: { id: site.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(normalizedAllowedDomains
          ? { allowedDomains: normalizedAllowedDomains }
          : {}),
        ...(parsed.data.themeConfig
          ? {
              themeConfig: parsed.data.themeConfig as Prisma.JsonObject,
            }
          : {}),
      },
    });

    const rotatedSite = await rotateWebChatSiteCredentials({
      siteId: updatedSite.id,
      rotatePublicKey: parsed.data.rotatePublicKey,
      rotateSecretKey: parsed.data.rotateSecretKey,
    });

    if (!rotatedSite) {
      return NextResponse.json(
        { error: "Webchat site not found after update" },
        { status: 404 },
      );
    }

    return NextResponse.json({ site: serializeSite(rotatedSite) });
  } catch (error) {
    console.error("[Webchat Site API] Failed to update site:", error);
    return NextResponse.json(
      { error: "Failed to update webchat site" },
      { status: 500 },
    );
  }
}
