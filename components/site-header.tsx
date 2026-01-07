import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function SiteHeader() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return null;
  }

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[var(--header-height)]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">ReplyBase</h1>
        <div className="ml-auto flex items-center gap-2">
          {session?.user && (
            <NavUser
              user={{
                name: session.user.name || "User",
                email: session.user.email || "",
                avatar: session.user.image || "",
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
