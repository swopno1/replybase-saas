"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, Lock, Bell, Shield, CreditCard } from "lucide-react";

interface SettingsNavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const settingsNav: SettingsNavItem[] = [
  {
    title: "Profile",
    href: "/settings/account",
    icon: <User className="h-4 w-4" />,
  },
  {
    title: "Security",
    href: "/settings/account",
    icon: <Lock className="h-4 w-4" />,
  },
  {
    title: "Notifications",
    href: "/settings/account",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    title: "Privacy",
    href: "/settings/account",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    title: "Billing",
    href: "/settings/billing",
    icon: <CreditCard className="h-4 w-4" />,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sidebar Navigation */}
      <div className="flex gap-6 md:gap-10">
        <nav className="hidden md:block md:w-48 shrink-0">
          <div className="space-y-1">
            {settingsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {item.icon}
                {item.title}
              </Link>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden space-y-1 border-t pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {settingsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                pathname === item.href
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {item.icon}
              {item.title}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
