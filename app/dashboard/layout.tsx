
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }>
            <AppSidebar variant="inset" />
            <SidebarInset>
            <SiteHeader />
            <main className="w-full">
            <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6"><div className="p-4 bg-muted/20 min-h-screen">
                    <SidebarTrigger />
                    <div className="mt-4">
                        {children}
                    </div>
                    </div>
                    </div>
                    </div>
                </div>
            </main></SidebarInset>
        </SidebarProvider>
    )
}
