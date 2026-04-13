/**
 * Shared cron authentication helper.
 *
 * All /api/cron/* routes import `isCronAuthorized` and call it as the first
 * thing inside GET/POST handlers. Returns false if CRON_SECRET is unset (fail-closed).
 *
 * Usage:
 *   import { isCronAuthorized } from "@/lib/cron-auth";
 *   if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed: no secret = no access

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  return parts.length === 2 && parts[0] === "Bearer" && parts[1] === secret;
}
