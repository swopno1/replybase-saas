import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

const updateContactSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
});

async function getContact(contactId: string, tenantId: string) {
  return await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });
}

// GET: Retrieve a specific contact
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const contact = await getContact(contactId, tenantId);
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ contact });
    } catch (error) {
      console.error("[Contacts API] Error fetching contact:", error);
      return NextResponse.json(
        { error: "Failed to fetch contact" },
        { status: 500 }
      );
    }
  });
}

// PUT: Update a specific contact
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const contact = await getContact(contactId, tenantId);
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }

      const body = await req.json();
      const validated = updateContactSchema.parse(body);

      const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: validated,
      });

      return NextResponse.json({ contact: updatedContact });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 }
        );
      }
      console.error("[Contacts API] Error updating contact:", error);
      return NextResponse.json(
        { error: "Failed to update contact" },
        { status: 500 }
      );
    }
  });
}

// DELETE: Delete a specific contact
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const contact = await getContact(contactId, tenantId);
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 }
        );
      }

      await prisma.contact.delete({
        where: { id: contactId },
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error("[Contacts API] Error deleting contact:", error);
      return NextResponse.json(
        { error: "Failed to delete contact" },
        { status: 500 }
      );
    }
  });
}
