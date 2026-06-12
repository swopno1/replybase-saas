import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getTenantLimits } from "@/lib/subscription";
import { getPlanConfig } from "@/lib/plans";
import { z } from "zod";

const brandingSchema = z.object({
  companyName: z.string().max(100).optional().nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  botAvatarUrl: z.string().url().max(500).optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  emailFromName: z.string().max(100).optional().nullable(),
  emailFromAddress: z.string().email().max(254).optional().nullable(),
});

async function requireBrandingAccess(tenantId: string) {
  const limits = await getTenantLimits(tenantId);
  const planConfig = getPlanConfig(limits.name);
  return (planConfig as any).whiteLabelBranding === true;
}

export const GET = withAuthAndTenant(async (user, _req, _ctx, db) => {
  const branding = await db.tenantBranding.findUnique({
    where: { tenantId: user.tenantId },
    select: {
      companyName: true,
      logoUrl: true,
      botAvatarUrl: true,
      primaryColor: true,
      accentColor: true,
      emailFromName: true,
      emailFromAddress: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(branding ?? {});
});

export const PUT = withAuthAndTenant(async (user, req, _ctx, db) => {
  const allowed = await requireBrandingAccess(user.tenantId);
  if (!allowed) {
    return NextResponse.json(
      { error: "White-label branding requires the Business plan." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid branding data", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const data = parsed.data;

  const branding = await db.tenantBranding.upsert({
    where: { tenantId: user.tenantId },
    create: { tenantId: user.tenantId, ...data },
    update: data,
    select: {
      companyName: true,
      logoUrl: true,
      botAvatarUrl: true,
      primaryColor: true,
      accentColor: true,
      emailFromName: true,
      emailFromAddress: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(branding);
});
