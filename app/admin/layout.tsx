import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

// Hardcoded admin email - DO NOT EXPOSE
const ADMIN_EMAIL = "amirhossain.limon@gmail.com";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Security check - only specific email can access
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Admin Dashboard
          </h1>
          <AdminNav />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">{children}</div>
    </div>
  );
}
