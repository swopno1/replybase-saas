import { PrismaClient } from "@prisma/client";

export class LeadService {
  constructor(private db: PrismaClient) {}

  async getLeads(tenantId: string, options: { status?: string | null; page?: number; limit?: number }) {
    const { status, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [leads, totalCount, subscription] = await Promise.all([
      this.db.lead.findMany({
        where: {
          tenantId,
          ...(status && { status }),
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.db.lead.count({
        where: {
          tenantId,
          ...(status && { status }),
        },
      }),
      this.db.subscription.findFirst({
        where: { tenantId, status: { in: ["active", "trialing"] } },
        include: { plan: { select: { price: true } } },
      }),
    ]);

    // CSV export is available for trial users and paid subscribers (plan.price > 0).
    const canExport =
      subscription?.status === "trialing" ||
      (subscription?.status === "active" &&
        (subscription.plan.price ?? 0) > 0);

    return {
      leads,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      canExport: canExport ?? false,
    };
  }

  async deleteLeads(tenantId: string, ids: string[] | "ALL") {
    const where = ids === "ALL" ? { tenantId } : { id: { in: ids }, tenantId };

    const { count } = await this.db.lead.deleteMany({
      where,
    });

    return { count };
  }

  async updateLeadsStatus(tenantId: string, ids: string[] | "ALL", status: string) {
    const where = ids === "ALL" ? { tenantId } : { id: { in: ids }, tenantId };

    const { count } = await this.db.lead.updateMany({
      where,
      data: { status },
    });

    return { count };
  }

  /**
   * Automatically tags a contact as QUALIFIED and ensures a Lead record exists
   * once they provide a Name and at least one Communication Method.
   */
  async syncContactIdentifiedStatus(tenantId: string, contactId: string) {
    const contact = await this.db.contact.findUnique({
      where: { id: contactId }, // Simplified where if ID is unique
      include: { identities: true, leads: true }
    });

    if (!contact) return;

    const hasName = !!contact.name && contact.name !== "Anonymous";
    const hasEmail = !!contact.email;
    const hasPhone = !!contact.phone;
    const hasSocialIdentity = contact.identities.some(i => 
      ["whatsapp_wa_id", "facebook_id", "telegram_user_id"].includes(i.type)
    );

    // Criteria: Name + (Email OR Phone OR Social Identity)
    const isIdentified = hasName && (hasEmail || hasPhone || hasSocialIdentity);

    if (isIdentified) {
      const existingLead = contact.leads[0];
      const tagToAdd = "QUALIFIED";

      if (existingLead) {
        const currentTags = Array.isArray(existingLead.tags) ? (existingLead.tags as string[]) : [];
        if (!currentTags.includes(tagToAdd)) {
          await this.db.lead.update({
            where: { id: existingLead.id },
            data: { 
              tags: [...currentTags, tagToAdd],
              // Sync contact details to lead if missing
              name: existingLead.name || contact.name || undefined,
              email: existingLead.email || contact.email || undefined,
              mobile: existingLead.mobile || contact.phone || undefined,
            }
          });
        }
      } else {
        // Create lead automatically for identified contacts
        await this.db.lead.create({
          data: {
            tenantId,
            contactId,
            status: "new",
            tags: [tagToAdd],
            source: "auto_identified",
            name: contact.name,
            email: contact.email,
            mobile: contact.phone,
          }
        });
      }
    }
  }
}

// Singleton instance for easy access across workers
import { prisma } from "@/lib/prisma";
export const leadService = new LeadService(prisma);
