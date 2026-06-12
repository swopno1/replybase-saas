"use client";

import {
  CrmConversation,
  User,
  ConversationStatus,
  Lead,
} from "@prisma/client";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Phone } from "lucide-react";

export function ConversationHeader({
  conversation: initialConversation,
  onRefresh,
}: {
  conversation: CrmConversation & {
    contact: {
      id: string;
      name: string | null;
      email?: string | null;
      phone?: string | null;
      leads?: Lead[];
    };
    assignee: Partial<User> | null;
    webChatSessions?: Array<{
      id: string;
      visitorId: string;
      lastSeenAt: string | Date;
      site?: {
        id: string;
        name: string;
      } | null;
    }>;
  };
  onRefresh: () => void;
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    queueMicrotask(() => setConversation(initialConversation));
  }, [initialConversation]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users));
  }, []);

  const handleUpdate = (data: Partial<CrmConversation>) => {
    fetch(`/api/conversations/${conversation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((data) => {
        setConversation((current) =>
          current ? { ...current, ...data.conversation } : data.conversation,
        );
        onRefresh();
      });
  };

  const handleLeadStatusUpdate = (status: string) => {
    const lead = conversation.contact.leads?.[0];
    if (!lead) return;

    fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then((res) => res.json())
      .then(() => {
        onRefresh();
      });
  };

  const latestWebSession = conversation.webChatSessions?.[0] ?? null;
  const latestWebSeenAt = latestWebSession?.lastSeenAt
    ? new Date(latestWebSession.lastSeenAt)
    : null;
  const isVisitorOnline = latestWebSeenAt
    ? Date.now() - latestWebSeenAt.getTime() < 5 * 60 * 1000
    : false;
  const contactDisplayName =
    conversation.contact.name ||
    conversation.contact.email ||
    conversation.contact.phone ||
    (conversation.channel === "web" ? "Website Visitor" : "Unknown Contact");

  return (
    <div className="p-4 border-b flex justify-between items-center">
      <div>
        <h2 className="font-bold text-lg">{contactDisplayName}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>Conversation Details</span>
          {conversation.channel === "web" ? (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isVisitorOnline
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {isVisitorOnline ? "Visitor online" : "Webchat visitor"}
            </span>
          ) : null}
          {latestWebSession?.site?.name ? (
            <span className="text-xs text-slate-500">
              Site: {latestWebSession.site.name}
            </span>
          ) : null}
          {conversation.botPaused ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Human handoff active
            </span>
          ) : null}
          {conversation.contact.email ? (
            <a
              href={`mailto:${conversation.contact.email}`}
              aria-label={`Email ${conversation.contact.email}`}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{conversation.contact.email}</span>
            </a>
          ) : null}
          {conversation.contact.phone ? (
            <a
              href={`tel:${conversation.contact.phone}`}
              aria-label={`Call ${conversation.contact.phone}`}
              className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{conversation.contact.phone}</span>
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="bot-paused"
            checked={conversation.botPaused}
            onCheckedChange={(checked) => handleUpdate({ botPaused: checked })}
          />
          <Label htmlFor="bot-paused">Bot Paused</Label>
        </div>
        <div className="flex items-center gap-2 border-r pr-4">
          <Select
            onValueChange={(status) =>
              handleUpdate({ status: status as ConversationStatus })
            }
            value={conversation.status}
          >
            <SelectTrigger className="w-30">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ConversationStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {conversation.contact.leads?.[0] && (
            <Select
              onValueChange={handleLeadStatusUpdate}
              value={conversation.contact.leads[0].status}
            >
              <SelectTrigger className="w-36 bg-blue-50 border-blue-200 text-blue-700">
                <SelectValue placeholder="Lead Status" />
              </SelectTrigger>
              <SelectContent>
                {["new", "contacted", "qualified", "converted", "lost"].map(
                  (status) => (
                    <SelectItem key={status} value={status}>
                      Lead: {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <Select
          onValueChange={(assigneeId) =>
            handleUpdate({
              assigneeId: assigneeId === "unassigned" ? null : assigneeId,
            })
          }
          value={conversation.assigneeId ?? "unassigned"}
        >
          <SelectTrigger className="w-45">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={conversation.assignee?.image ?? ""} />
                <AvatarFallback>
                  {conversation.assignee?.name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <SelectValue placeholder="Assignee" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
