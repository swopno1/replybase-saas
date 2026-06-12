import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  getAvailableTemplates,
  getTemplateByCategory,
} from "@/lib/flow-templates";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const POST = withAuthAndTenant(async (user, request, _context, db) => {
  try {
    const body = await request.json();
    const { templateCategory, flowName, flowDescription, isGlobal } = body;

    if (isGlobal && !user.isAdmin) {
      return NextResponse.json(
        { error: "Only admins can create global flows" },
        { status: 403 },
      );
    }

    const template = getTemplateByCategory(templateCategory);
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${templateCategory}` },
        { status: 400 },
      );
    }

    const flow = await db.flow.create({
      data: {
        name: flowName || template.name,
        description: flowDescription || template.description,
        tenantId: user.tenantId,
        ownerId: user.id,
        isGlobal: isGlobal ?? false,
        isActive: false,
        version: 1,
        language: "en",
        fallbackMessage: "Sorry, I didn't understand that. Please try again.",
        maxTimeout: 300,
        nodes: {
          create: template.nodes.map(
            (node) =>
              ({
                type: node.type,
                content: node.content as Prisma.InputJsonValue,
                order: node.order,
              }) as Prisma.FlowNodeCreateWithoutFlowInput,
          ),
        },
      },
      include: {
        nodes: {
          orderBy: { order: "asc" },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      flow,
      message: `Flow created from ${template.name} template`,
    });
  } catch (error) {
    console.error("[Flows] Error creating flow from template:", error);
    return NextResponse.json(
      { error: "Failed to create flow from template" },
      { status: 500 },
    );
  }
});

export async function GET() {
  try {
    const templates = getAvailableTemplates();

    return NextResponse.json({
      templates: templates.map((t) => ({
        category: t.category,
        name: t.name,
        description: t.description,
        icon: t.icon,
        group: t.group,
        nodeCount: t.nodes.length,
      })),
      message: `Found ${templates.length} templates`,
    });
  } catch (error) {
    console.error("[Flows] Error retrieving templates:", error);
    return NextResponse.json(
      { error: "Failed to retrieve templates" },
      { status: 500 },
    );
  }
}
