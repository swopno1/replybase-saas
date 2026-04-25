import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { AdminLayoutWrapper } from "@/components/admin/admin-layout-wrapper";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!isPlatformAdmin(session)) {
    redirect("/");
  }

  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
