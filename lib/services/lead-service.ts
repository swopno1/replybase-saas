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
}
