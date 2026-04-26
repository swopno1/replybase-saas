import type { Session } from "next-auth";

export function isPlatformAdmin(session: Session | null): session is Session {
  if (!session?.user?.id) {
    return false;
  }

  const role = session.user.role;
  return role === "ADMIN" || role === "SUPERADMIN";
}
