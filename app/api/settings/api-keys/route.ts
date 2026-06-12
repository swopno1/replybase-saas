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

  const maxApiKeys = (planConfig as any).maxApiKeys as number;
  const currentCount = await db.apiKey.count({ where: { isActive: true } });

  if (currentCount >= maxApiKeys) {
    return NextResponse.json(
      {
        error: `API key limit reached. Your ${planConfig.displayName} plan allows up to ${maxApiKeys} active API keys.`,
      },
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

    return NextResponse.json(
      {
        id: apiKey.id,
        name: apiKey.name,
        key, // Only returned once on creation
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
});
