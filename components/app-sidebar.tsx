"use client";

import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Activity,
  Users,
  MessagesSquare,
  UserCheck,
  GitBranch,
  Bot,
  Send,
  Globe,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChannelVisibleInUi, type ChannelId } from "@/lib/channel-config";
import { FacebookLogo } from "@/components/icons/MetaIcons";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Menu items.
const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Bots",
    url: "/bots",
    icon: Bot,
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Users,
  },
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessagesSquare,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: UserCheck,
  },
  {
    title: "Flows",
    url: "/flows",
    icon: GitBranch,
  },
  {
    title: "Telegram Bot",
    url: "/integrations/telegram",
    icon: Send,
    channelId: "telegram" as ChannelId,
  },
  {
    title: "WhatsApp Business",
    url: "/integrations/whatsapp",
    icon: MessageCircle,
    channelId: "whatsapp" as ChannelId,
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const visibleItems = items.filter(
    (item) => !item.channelId || isChannelVisibleInUi(item.channelId),
  );

  return (
    <Sidebar {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>ReplyBase</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.url ||
                  (item.url !== "/" && pathname?.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
