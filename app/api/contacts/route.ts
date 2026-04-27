import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { recordActivity } from "@/lib/activity-log";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const createContactSchema = z
  .object({
    name: z.string().max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.name && !data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one of 'name', 'email', or 'phone' must be provided.",
      });
    }
  });

// GET: List tenant's contacts
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [contacts, totalCount] = await Promise.all([
      prisma.contact.findMany({
        where: { tenantId },
        include: {
          conversations: {
            select: { id: true, channel: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
          },
          identities: { select: { type: true, value: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({
        where: { tenantId },
      }),
    ]);

    return NextResponse.json({
      contacts,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("[Contacts API] Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
});

// POST: Create a new contact
export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ id, tenantId }, request) => {
    try {
      const body = await request.json();
      const validated = createContactSchema.parse(body);

      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
        },
      });

      await recordActivity({
        tenantId,
        userId: id,
        type: "contact_created",
        title: "Contact Added",
        description: `Added contact ${contact.name || contact.email || contact.phone || contact.id}`,
        entityType: "contact",
        entityId: contact.id,
      });

      return NextResponse.json({ contact }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 },
        );
      }
      console.error("[Contacts API] Error creating contact:", error);
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 },
      );
    }
  },
);

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const { ids } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0)) {
      return NextResponse.json(
        { error: "Invalid input: ids must be a non-empty array or 'ALL'" },
        { status: 400 },
      );
    }

    const where = ids === "ALL" ? { tenantId } : { id: { in: ids }, tenantId };

    const { count } = await prisma.contact.deleteMany({
      where,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[Contacts API] Batch delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete contacts" },
      { status: 500 },
    );
  }
});
