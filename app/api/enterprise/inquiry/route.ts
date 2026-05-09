import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || message.length < 10) {
      return NextResponse.json({ error: "Message too short" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@replybase.co.uk";
    
    await sendEmail({
      to: adminEmail,
      subject: `Enterprise Inquiry from ${user?.tenant?.name || "Unknown Tenant"}`,
      text: `
Enterprise Inquiry Details:
---------------------------
User: ${user?.name || "N/A"} (${user?.email || "N/A"})
Tenant: ${user?.tenant?.name || "N/A"} (${user?.tenantId || "N/A"})

Message:
${message}
      `.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Enterprise API] Error processing inquiry:", error);
    return NextResponse.json(
      { error: "Failed to send inquiry" },
      { status: 500 }
    );
  }
}
