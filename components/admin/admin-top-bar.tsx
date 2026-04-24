"use client";

import React from "react";
import { NavUser } from "@/components/nav-user";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export function AdminTopBar() {
  const { data: session } = useSession();

  const user = {
    name: session?.user?.name || "Admin",
    email: session?.user?.email || "",
    avatar: "",
    isAdmin: session?.user?.isAdmin,
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-9 bg-gray-50 border-none focus-visible:ring-1 focus-visible:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-gray-500">
          <Bell size={20} />
        </Button>
        <NavUser user={user} />
      </div>
    </header>
  );
}
