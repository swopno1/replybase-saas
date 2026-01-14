import { getServerSession, Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

type AuthenticatedRouteHandler = (
  req: Request,
  res: { params: Record<string, string> },
  context: { session: Session; tenantId: string }
) => Promise<NextResponse>;

export function withAuthAndTenant(handler: AuthenticatedRouteHandler) {
  return async (req: Request, res: { params: Record<string, string> }) => {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      console.error("CRITICAL: User session is missing tenantId.", { userId: session.user.id });
      return NextResponse.json({ error: "Internal Server Error: Tenant not found." }, { status: 500 });
    }

    return handler(req, res, { session, tenantId });
  };
}
