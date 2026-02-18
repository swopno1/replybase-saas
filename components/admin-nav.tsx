"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { name: "Business Status", href: "/admin" },
  { name: "Subscribers", href: "/admin/subscribers" },
  { name: "Onboarding", href: "/admin/onboarding" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex space-x-1 border-b">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname?.startsWith(tab.href);

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={cn(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
              isActive
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
