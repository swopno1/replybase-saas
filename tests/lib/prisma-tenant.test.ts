import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/prisma-tenant";

describe("Cross-Tenant Data Isolation (Prisma Extension)", () => {
  const tenantA = "tenant-a-id-test";
  const tenantB = "tenant-b-id-test";

  beforeAll(async () => {
    // Clean up any left overs
    await prisma.contact.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });

    // Create test tenants
    await prisma.tenant.createMany({
      data: [{ id: tenantA, name: "Tenant A" }, { id: tenantB, name: "Tenant B" }],
      skipDuplicates: true,
    });

    // Create contacts for each tenant
    await prisma.contact.create({
      data: {
        id: "contact-a",
        tenantId: tenantA,
        name: "Alice A",
        email: "alice@a.com",
      },
    });

    await prisma.contact.create({
      data: {
        id: "contact-b",
        tenantId: tenantB,
        name: "Bob B",
        email: "bob@b.com",
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.contact.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  });

  it("should only return contacts for tenant A when using tenant A's client", async () => {
    const dbA = getTenantPrisma(tenantA);
    const contacts = await dbA.contact.findMany();
    
    expect(contacts).toHaveLength(1);
    expect(contacts[0].tenantId).toBe(tenantA);
    expect(contacts[0].name).toBe("Alice A");
  });

  it("should block updating a contact belonging to another tenant", async () => {
    const dbA = getTenantPrisma(tenantA);
    
    // Attempting to update Bob B (who belongs to Tenant B) using Tenant A's client
    await expect(
      dbA.contact.update({
        where: { id: "contact-b" },
        data: { name: "Hacked by A" },
      })
    ).rejects.toThrow(/not found/);
  });

  it("should automatically inject tenantId on create without requiring it in the payload", async () => {
    const dbB = getTenantPrisma(tenantB);
    
    const newContact = await dbB.contact.create({
      data: {
        id: "contact-b-new",
        name: "Charlie B",
        email: "charlie@b.com",
      } as any, // bypassing TS strict check since tenantId is omitted
    });

    expect(newContact.tenantId).toBe(tenantB);

    // Verify it exists in the global db under the correct tenant
    const globalContact = await prisma.contact.findUnique({
      where: { id: "contact-b-new" },
    });
    expect(globalContact?.tenantId).toBe(tenantB);

    // Cleanup
    await dbB.contact.delete({ where: { id: "contact-b-new" } });
  });
});
