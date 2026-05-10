import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  getOrCreateWebChatSite,
  rotateWebChatSiteCredentials,
  serializeSite
} from "@/lib/webchat";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).optional(),
  allowedDomains: z.array(z.string()).optional(),
  themeConfig: z.record(z.string(), z.unknown()).optional(),
  rotatePublicKey: z.boolean().optional(),
  rotateSecretKey: z.boolean().optional(),
});

function normalizeAllowedDomains(domains: string[]): string[] {
  return domains
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0)
    .map((d) => {
      try {
        if (!d.startsWith("http://") && !d.startsWith("https://")) {
          return new URL(`https://${d}`).origin;
        }
        return new URL(d).origin;
      } catch {
        return "";
      }
    })
    .filter((d) => d.length > 0);
}

export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const channelId = req.nextUrl.searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    const channel = await db.channel.findFirst({
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
        flowAssignments: {
          where: { isActive: true },
          include: {
            flow: {
              select: { id: true, name: true, isActive: true }
            }
          }
        }
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
      tenantId: tenantId,
      name: channel.name,
      themeConfig: (channel.config as Prisma.JsonObject | null) || {},
    });

    return NextResponse.json({ 
      site: {
        ...serializeSite(site),
        channel: {
          flowAssignments: channel.flowAssignments
        }
      } 
    });
  } catch (error) {
    console.error("[Webchat Site API] Failed to load site:", error);
    return NextResponse.json(
      { error: "Failed to load webchat site" },
      { status: 500 },
    );
  }
});

export const PATCH = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };

    const body = await req.json();
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

    const channel = await db.channel.findFirst({
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
        flowAssignments: {
          where: { isActive: true },
          include: {
            flow: {
              select: { id: true, name: true }
            }
          }
        }
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
      tenantId: tenantId,
      name: channel.name,
      themeConfig: (channel.config as Prisma.JsonObject | null) || {},
    });

    const updatedSite = await db.webChatSite.update({
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

    // Also sync these updates back to the parent Channel record so the UI lists stay updated
    await db.channel.update({
      where: { id: channel.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.themeConfig
          ? { config: parsed.data.themeConfig as Prisma.JsonObject }
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

    // Log webchat site configuration for KPI tracking
    await recordWebhookSetupLog({
      source: "webchat",
      event: "webchat_configure",
      outcome: "setup_success",
      tenantId: tenantId,
      channelId: channel.id,
      metadata: {
        siteName: rotatedSite.name,
        allowedDomainsCount: Array.isArray(rotatedSite.allowedDomains)
          ? rotatedSite.allowedDomains.filter(
              (d): d is string => typeof d === "string",
            ).length
          : 0,
      },
    }).catch((err) =>
      console.error("[Webchat Site API] Failed to log configuration:", err),
    );

    return NextResponse.json({ 
      site: {
        ...serializeSite(rotatedSite),
        channel: {
          flowAssignments: channel.flowAssignments
        }
      } 
    });
  } catch (error) {
    console.error("[Webchat Site API] Failed to update site:", error);
    return NextResponse.json(
      { error: "Failed to update webchat site" },
      { status: 500 },
    );
  }
});
