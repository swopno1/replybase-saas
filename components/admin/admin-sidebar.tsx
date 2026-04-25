"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  HeartPulse,
  Users,
  PieChart,
  UserPlus,
  Monitor,
  Rocket,
  ShieldCheck,
  History,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: "Business Status", href: "/admin", icon: LayoutDashboard },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "KPI Health", href: "/admin/kpi-health", icon: HeartPulse },
  { name: "Subscribers", href: "/admin/subscribers", icon: ShieldCheck },
  {
    name: "Segmented Analytics",
    href: "/admin/segmented-analytics",
    icon: PieChart,
  },
  { name: "Onboarding", href: "/admin/onboarding", icon: UserPlus },
  {
    name: "Webchat Monitoring",
    href: "/admin/webchat-monitoring",
    icon: Monitor,
  },
  { name: "Webchat Rollout", href: "/admin/webchat-rollout", icon: Rocket },
  { name: "Webhook Logs", href: "/admin/webhook-logs", icon: History },
  { name: "User Management", href: "/admin/users", icon: Users },
];

export function AdminSidebar({
  isCollapsed,
  setIsCollapsed,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r bg-white transition-all duration-300 h-screen sticky top-0",
        isCollapsed ? "w-[80px]" : "w-[260px]",
      )}
    >
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && (
          <Link href="/" className="font-bold text-xl tracking-tight">
            Replybase Admin
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <item.icon
                size={20}
                className={cn(isActive ? "text-blue-600" : "text-gray-400")}
              />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminMobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <Link href="/" className="font-bold">
          Replybase Admin
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <Menu size={24} />
        </Button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-white transform transition-transform duration-300 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 flex items-center justify-between border-b">
          <Link href="/" className="font-bold text-xl">
            Replybase Admin
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </Button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon
                  size={22}
                  className={cn(isActive ? "text-blue-600" : "text-gray-400")}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
