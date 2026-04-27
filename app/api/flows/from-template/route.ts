import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  getAvailableTemplates,
  getTemplateByCategory,
} from "@/lib/flow-templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/flows/from-template
 * Create a new flow from a template
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { templateCategory, flowName, flowDescription, isGlobal } = body;

    // Only admins can create global flows
    if (isGlobal && !isPlatformAdmin(session)) {
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

    // Create the flow
    const flow = await prisma.flow.create({
      data: {
        name: flowName || template.name,
        description: flowDescription || template.description,
        tenantId: user.tenantId,
        ownerId: session.user.id,
        isGlobal: isGlobal ?? false,
        isActive: false, // Start inactive so user can customize
        version: 1,
        language: "en",
        fallbackMessage: "Sorry, I didn't understand that. Please try again.",
        maxTimeout: 300,
        // Create nodes from template
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
}

/**
 * GET /api/flows/templates
 * Retrieve available flow templates
 */
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
