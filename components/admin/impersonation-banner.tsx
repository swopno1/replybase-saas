"use client";

import { useSession } from "next-auth/react";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { data: session, update } = useSession();

  if (!session?.user?.isImpersonating) {
    return null;
  }

  const handleStopImpersonating = async () => {
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Resumed your administrator session");
        // We force a hard reload to clear all cached tenant states
        window.location.href = "/admin/subscribers";
      } else {
        toast.error("Failed to stop impersonation");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-[100] shadow-md border-b border-amber-600">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 animate-pulse" />
        <div className="text-sm font-medium">
          <span className="hidden sm:inline">You are currently impersonating </span>
          <span className="font-bold underline decoration-2 underline-offset-4">
            {session.user.name || "a tenant user"}
          </span>
          <span className="ml-2 bg-amber-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            Admin View
          </span>
        </div>
      </div>
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={handleStopImpersonating}
        className="bg-white text-amber-600 hover:bg-amber-50 h-8 font-bold"
      >
        <LogOut className="mr-2 h-4 w-4" /> Stop Impersonating
      </Button>
    </div>
  );
}
