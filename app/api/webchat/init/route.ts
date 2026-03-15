import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createWebchatSessionToken } from "@/lib/webchat-session";
import {
  findActiveWebChannel,
  resolveWebchatVisitorSession,
} from "@/lib/webchat";
import {
  createWebchatCorsHeaders,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";

const initSchema = z
  .object({
    channelId: z.string().min(1).optional(),
    botId: z.string().min(1).optional(),
    visitorId: z.string().min(1).optional(),
    contact: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.channelId && !data.botId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide channelId or botId",
        path: ["channelId"],
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    if (!isWebchatOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const body = await request.json();
    const parsed = initSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.issues,
        },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    const channel = await findActiveWebChannel({
      channelId: parsed.data.channelId,
      botId: parsed.data.botId,
    });

    if (!channel?.bot) {
      return NextResponse.json(
        { error: "Active web channel not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }

    const session = await resolveWebchatVisitorSession({
      botId: channel.bot.id,
      tenantId: channel.bot.tenantId,
      channelId: channel.id,
      visitorId: parsed.data.visitorId,
      contact: parsed.data.contact,
      metadata: parsed.data.metadata,
    });

    const token = createWebchatSessionToken({
      channelId: channel.id,
      botId: channel.bot.id,
      tenantId: channel.bot.tenantId,
      conversationId: session.conversation.id,
      visitorId: session.visitorId,
    });

    return NextResponse.json(
      {
        token,
        visitorId: session.visitorId,
        conversationId: session.conversation.id,
        channelId: channel.id,
        botId: channel.bot.id,
        expiresIn: 60 * 60 * 24,
      },
      { headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    console.error("[Webchat Init] Failed to initialize session:", error);
    return NextResponse.json(
      { error: "Failed to initialize webchat" },
      { status: 500, headers: createWebchatCorsHeaders(request) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    return new NextResponse(null, {
      status: 403,
      headers: createWebchatCorsHeaders(request),
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: createWebchatCorsHeaders(request),
  });
}
