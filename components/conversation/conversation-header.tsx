"use client";

import { CrmConversation, User, ConversationStatus } from "@prisma/client";
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

export function ConversationHeader({
  conversation: initialConversation,
  onRefresh,
}: {
  conversation: CrmConversation & {
    contact: { name: string | null };
    assignee: Partial<User> | null;
  };
  onRefresh: () => void;
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [users, setUsers] = useState<User[]>([]);

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
        setConversation(data.conversation);
        onRefresh();
      });
  };

  return (
    <div className="p-4 border-b flex justify-between items-center">
      <div>
        <h2 className="font-bold text-lg">
          {conversation.contact.name || "Unknown Contact"}
        </h2>
        <p className="text-sm text-gray-500">Conversation Details</p>
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
        <Select
          onValueChange={(status) =>
            handleUpdate({ status: status as ConversationStatus })
          }
          value={conversation.status}
        >
          <SelectTrigger className="w-[120px]">
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
        <Select
          onValueChange={(assigneeId) => handleUpdate({ assigneeId })}
          value={conversation.assigneeId ?? "unassigned"}
        >
          <SelectTrigger className="w-[180px]">
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
