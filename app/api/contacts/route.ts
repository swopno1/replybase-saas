import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

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
        message: "At least one of 'name', 'email', or 'phone' must be provided.",
      });
    }
  });

// GET: List tenant's contacts
export async function GET() {
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const contacts = await prisma.contact.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ contacts });
    } catch (error) {
      console.error("[Contacts API] Error fetching contacts:", error);
      return NextResponse.json(
        { error: "Failed to fetch contacts" },
        { status: 500 }
      );
    }
  });
}

// POST: Create a new contact
export async function POST(req: NextRequest) {
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const body = await req.json();
      const validated = createContactSchema.parse(body);

      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
        },
      });

      return NextResponse.json({ contact }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 }
        );
      }
      console.error("[Contacts API] Error creating contact:", error);
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 }
      );
    }
  });
}
