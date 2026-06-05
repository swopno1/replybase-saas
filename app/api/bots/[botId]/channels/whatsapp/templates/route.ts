import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { decryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import { listWhatsAppTemplates, type MetaCloudCredentials } from "@/lib/whatsapp-provider";

export const dynamic = "force-dynamic";

// GET /api/bots/[botId]/channels/whatsapp/templates
// Returns approved WhatsApp message templates from the connected WABA (Meta Cloud only).
export const GET = withAuthAndTenant(async ({ tenantId }, _req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };

    const channel = await db.channel.findFirst({
      where: {
        botId,
        type: "whatsapp",
        isActive: true,
        enabled: true,
        bot: { tenantId },
      },
      select: { id: true, accessToken: true },
    });

    if (!channel?.accessToken) {
      return NextResponse.json(
        { error: "WhatsApp channel not connected. Configure it in Integrations > WhatsApp." },
        { status: 404 },
      );
    }

    const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);

    if (envelope.provider !== "meta_cloud") {
      return NextResponse.json(
        {
          error: "Template listing is only available for Meta Cloud API. Twilio and 360dialog manage templates through their own portals.",
          templates: [],
        },
        { status: 200 },
      );
    }

    const result = await listWhatsAppTemplates(envelope.credentials as MetaCloudCredentials);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ templates: result.templates ?? [] });
  } catch (error) {
    console.error("[WhatsApp Templates] Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp templates" },
      { status: 500 },
    );
  }
});
