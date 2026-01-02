
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <div className="p-4 bg-muted/20 min-h-screen">
                    <SidebarTrigger />
                    <div className="mt-4">
                        {children}
                    </div>
                </div>
            </main>
        </SidebarProvider>
    )
}
