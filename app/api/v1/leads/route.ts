import { NextRequest, NextResponse } from "next/server";
import { withApiKey } from "@/lib/route-helpers";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import { sendNewLeadNotifications } from "@/lib/lead-notifications";

const leadSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().min(3).max(40).optional(),
  source: z.string().default("api"),
  enquiry: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone must be provided",
  path: ["email"]
});

export const POST = withApiKey(async (tenantId, request, ctx, db) => {
  try {
    const body = await request.json();
    const parsed = leadSchema.parse(body);

    // Get or create contact
    let contact = await db.contact.findFirst({
      where: {
        OR: [
          ...(parsed.email ? [{ email: parsed.email }] : []),
          ...(parsed.phone ? [{ phone: parsed.phone }] : []),
        ]
      }
    });

    if (!contact) {
      contact = await db.contact.create({
        data: {
          tenantId,
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
        }
      });
    }

    const lead = await db.lead.create({
      data: {
        tenantId,
        contactId: contact.id,
        name: parsed.name,
        email: parsed.email,
        mobile: parsed.phone,
        source: parsed.source,
        status: "new",
        metadata: {
          ...parsed.metadata,
          enquiry: parsed.enquiry,
          auth_method: "api_key"
        }
      }
    });

    // Background notifications
    Promise.all([
      sendNewLeadNotifications({
        tenantId,
        leadId: lead.id,
        name: parsed.name,
        enquiry: parsed.enquiry || "Programmatic lead capture",
        email: parsed.email,
        phone: parsed.phone,
        source: parsed.source,
        createdAt: lead.createdAt,
      }),
      recordActivity({
        tenantId,
        type: "lead_created",
        title: "API Lead Captured",
        description: `Captured lead from API: ${parsed.name}`,
        entityType: "lead",
        entityId: lead.id,
        metadata: { source: parsed.source }
      })
    ]).catch(err => console.error("[API v1 Leads] Notification error:", err));

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      contactId: contact.id
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const GET = withApiKey(async (tenantId, request, ctx, db) => {
  const leads = await db.lead.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      contact: {
        select: {
          name: true,
          email: true,
          phone: true
        }
      }
    }
  });

  return NextResponse.json(leads);
});
