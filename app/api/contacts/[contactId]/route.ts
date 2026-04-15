import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

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
export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { contactId } = await context.params;
    try {
      const contact = await getContact(contactId as string, tenantId);
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ contact });
    } catch (error) {
      console.error("[Contacts API] Error fetching contact:", error);
      return NextResponse.json(
        { error: "Failed to fetch contact" },
        { status: 500 },
      );
    }
  },
);

// PUT: Update a specific contact
export const PUT: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { contactId } = await context.params;
    try {
      const contact = await getContact(contactId as string, tenantId);
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 },
        );
      }

      const body = await request.json();
      const validated = updateContactSchema.parse(body);

      const updatedContact = await prisma.contact.update({
        where: { id: contactId as string },
        data: validated,
      });

      return NextResponse.json({ contact: updatedContact });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid input", details: error.issues },
          { status: 400 },
        );
      }
      console.error("[Contacts API] Error updating contact:", error);
      return NextResponse.json(
        { error: "Failed to update contact" },
        { status: 500 },
      );
    }
  },
);

// DELETE: Delete a specific contact
export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { contactId } = await context.params;
    try {
      const contact = await getContact(contactId as string, tenantId);
      if (!contact) {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 },
        );
      }

      const id = contactId as string;

      await prisma.$transaction(async (tx) => {
        // Keep lead history but detach it from the deleted contact.
        await tx.lead.updateMany({
          where: { contactId: id },
          data: { contactId: null },
        });

        await tx.crmMessage.deleteMany({
          where: { conversation: { contactId: id } },
        });

        await tx.internalNote.deleteMany({
          where: { conversation: { contactId: id } },
        });

        await tx.crmConversation.deleteMany({
          where: { contactId: id },
        });

        await tx.contactIdentity.deleteMany({
          where: { contactId: id },
        });

        await tx.contact.delete({
          where: { id },
        });
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error("[Contacts API] Error deleting contact:", error);
      return NextResponse.json(
        { error: "Failed to delete contact" },
        { status: 500 },
      );
    }
  },
);
