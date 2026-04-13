import type { Session } from "next-auth";

const BOOTSTRAP_ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "amirhossain.limon@gmail.com";

export function isPlatformAdmin(session: Session | null): session is Session {
  if (!session?.user?.id) {
    return false;
  }

  return Boolean(
    session.user.isAdmin || session.user.email === BOOTSTRAP_ADMIN_EMAIL,
  );
}
