import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { findActiveWebChatSite, isOriginAllowedForSite } from "@/lib/webchat";
import { sendNewLeadNotifications } from "@/lib/lead-notifications";
import {
  createWebchatCorsHeaders,
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import {
  consumeWebchatRateLimit,
  createWebchatRateLimitHeaders,
  getWebchatLimiterKeyFromRequest,
} from "@/lib/webchat-rate-limit";

export const dynamic = "force-dynamic";

const leadCaptureSchema = z
  .object({
    publicKey: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    enquiry: z.string().trim().min(1).max(4000),
    email: z.string().trim().email().max(320).optional().or(z.literal("")),
    phone: z.string().trim().min(3).max(40).optional().or(z.literal("")),
    source: z.enum(["website", "webchat", "form"]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    const hasEmail = typeof data.email === "string" && data.email.trim() !== "";
    const hasPhone = typeof data.phone === "string" && data.phone.trim() !== "";

    if (!hasEmail && !hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one contact method: email or phone",
        path: ["email"],
      });
    }
  });

function normalizeOptionalString(value?: string) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalEmail(value?: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  return normalized.toLowerCase();
}

async function getOrCreateLeadContact(params: {
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
}) {
  const identityFilters: Prisma.ContactWhereInput[] = [];

  if (params.email) {
    identityFilters.push({ email: params.email });
  }

  if (params.phone) {
    identityFilters.push({ phone: params.phone });
  }

  const existingContact =
    identityFilters.length > 0
      ? await prisma.contact.findFirst({
          where: {
            tenantId: params.tenantId,
            OR: identityFilters,
          },
        })
      : null;

  if (existingContact) {
    const updates: Prisma.ContactUpdateInput = {};

    if (!existingContact.name && params.name) {
      updates.name = params.name;
    }
    if (!existingContact.email && params.email) {
      updates.email = params.email;
    }
    if (!existingContact.phone && params.phone) {
      updates.phone = params.phone;
    }

    if (Object.keys(updates).length === 0) {
      return existingContact;
    }

    try {
      return await prisma.contact.update({
        where: { id: existingContact.id },
        data: updates,
      });
    } catch {
      return existingContact;
    }
  }

  try {
    return await prisma.contact.create({
      data: {
        tenantId: params.tenantId,
        name: params.name,
        email: params.email,
        phone: params.phone,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      identityFilters.length > 0
    ) {
      return await prisma.contact.findFirst({
        where: {
          tenantId: params.tenantId,
          OR: identityFilters,
        },
      });
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isWebchatOriginAllowed(request))) {
      const reason = await getWebchatOriginRejectionReason(request);
      return NextResponse.json(
        { error: "Origin not allowed", reason },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const body = await request.json();
    const parsed = leadCaptureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.issues,
        },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    const site = await findActiveWebChatSite({
      publicKey: parsed.data.publicKey,
    });
    if (!site) {
      return NextResponse.json(
        { error: "Webchat site not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;

    if (!isOriginAllowedForSite(site, requestOrigin, requestReferer)) {
      return NextResponse.json(
        { error: "Origin not allowed for this site" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const rateLimit = await consumeWebchatRateLimit({
      scope: "init_ip",
      key: `${getWebchatLimiterKeyFromRequest(request)}:${site.id}:lead_capture`,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many lead submissions. Please retry shortly.",
        },
        {
          status: 429,
          headers: {
            ...createWebchatCorsHeaders(request),
            ...createWebchatRateLimitHeaders(rateLimit),
          },
        },
      );
    }

    const email = normalizeOptionalEmail(parsed.data.email);
    const phone = normalizeOptionalString(parsed.data.phone);
    const name = parsed.data.name.trim();

    const contact = await getOrCreateLeadContact({
      tenantId: site.bot.tenantId,
      name,
      email,
      phone,
    });

    const leadSource = parsed.data.source || "website";

    const lead = await prisma.lead.create({
      data: {
        tenantId: site.bot.tenantId,
        contactId: contact?.id,
        name,
        email,
        mobile: phone,
        source: leadSource,
        status: "new",
        metadata: {
          enquiry: parsed.data.enquiry,
          siteId: site.id,
          publicKey: site.publicKey,
          origin: requestOrigin || null,
          referer: requestReferer || null,
          ...(parsed.data.metadata || {}),
        } as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const [notifications] = await Promise.all([
      sendNewLeadNotifications({
        tenantId: site.bot.tenantId,
        leadId: lead.id,
        name,
        enquiry: parsed.data.enquiry,
        email,
        phone,
        source: leadSource,
        createdAt: lead.createdAt,
      }),
      recordActivity({
        tenantId: site.bot.tenantId,
        type: "lead_created",
        title: "Lead Captured",
        description: `Captured ${leadSource} lead from ${name}`,
        entityType: "lead",
        entityId: lead.id,
        metadata: {
          source: leadSource,
          siteId: site.id,
        } as Prisma.InputJsonValue,
      }),
      (async () => {
        try {
          const { messageQueue } = await import("@/lib/queue");
          if (messageQueue) {
            await messageQueue.add("lead-enrichment", {
              type: "lead_enrichment",
              botId: site.bot.id,
              payload: {
                tenantId: site.bot.tenantId,
                leadId: lead.id,
                leadData: {
                  id: lead.id,
                  name,
                  email,
                  phone,
                  source: leadSource,
                  enquiry: parsed.data.enquiry,
                  metadata: parsed.data.metadata || {},
                  createdAt: lead.createdAt,
                }
              },
            });
          }
        } catch (err) {
          console.error("[Public Leads API] Failed to queue lead enrichment:", err);
        }
      })()
    ]);

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        createdAt: lead.createdAt,
      },
      { status: 201, headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    console.error("[Public Leads API] Failed to capture lead:", error);
    return NextResponse.json(
      { error: "Failed to capture lead" },
      { status: 500, headers: createWebchatCorsHeaders(request) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  if (!(await isWebchatOriginAllowed(request))) {
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
