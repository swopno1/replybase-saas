import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { generateApiKey } from "@/lib/api-keys";
import { getTenantLimits } from "@/lib/subscription";
import { getPlanConfig } from "@/lib/plans";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1).max(50),
});

export const GET = withAuthAndTenant(async (user, req, ctx, db) => {
  const keys = await db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsed: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(keys);
});

export const POST = withAuthAndTenant(async (user, req, ctx, db) => {
  const limits = await getTenantLimits(user.tenantId);
  const planConfig = getPlanConfig(limits.name);

  if (!(planConfig as any).apiAccess) {
    return NextResponse.json(
      { error: "API access requires Scale or Business plan." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name } = createKeySchema.parse(body);

    const { key, hash, prefix } = generateApiKey();

    const apiKey = await db.apiKey.create({
      data: {
        tenantId: user.tenantId,
        name,
        keyHash: hash,
        prefix,
      },
    });

    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      key: key, // Only returned once on creation
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
});
