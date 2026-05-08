import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const updateContactSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
});

// GET: Retrieve a specific contact
export const GET = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    const { contactId } = await context.params;
    try {
      const contact = await db.contact.findFirst({
        where: { id: contactId as string, tenantId },
      });
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
export const PUT = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    const { contactId } = await context.params;
    try {
      const id = contactId as string;

      const body = await request.json();
      const validated = updateContactSchema.parse(body);

      const updatedContact = await db.contact.update({
        where: { id, tenantId },
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
      // Prisma error for not found (P2025)
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 },
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
export const DELETE = withAuthAndTenant(
  async ({ tenantId }, request, context, db) => {
    const { contactId } = await context.params;
    try {
      const id = contactId as string;

      await db.$transaction(async (tx) => {
        // Verify ownership first within transaction
        const contact = await tx.contact.findFirst({
           where: { id, tenantId },
           select: { id: true }
        });

        if (!contact) {
          throw new Error("NOT_FOUND");
        }

        // Keep lead history but detach it from the deleted contact.
        await tx.lead.updateMany({
          where: { contactId: id, tenantId },
          data: { contactId: null },
        });

        await tx.crmMessage.deleteMany({
          where: { conversation: { contactId: id, tenantId } },
        });

        await tx.internalNote.deleteMany({
          where: { conversation: { contactId: id, tenantId } },
        });

        await tx.crmConversation.deleteMany({
          where: { contactId: id, tenantId },
        });

        await tx.contactIdentity.deleteMany({
          where: { contactId: id, tenantId },
        });

        await tx.contact.delete({
          where: { id, tenantId },
        });
      });

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Contact not found" },
          { status: 404 },
        );
      }
      console.error("[Contacts API] Error deleting contact:", error);
      return NextResponse.json(
        { error: "Failed to delete contact" },
        { status: 500 },
      );
    }
  },
);
