"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, Copy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmation } from "@/components/ui/confirmation-provider";

type ConversationListItem = {
  id: string;
  channel: string;
  updatedAt: string;
  contact: {
    id: string;
    name: string | null;
  };
};

type ConversationsListProps = {
  initialConversations: ConversationListItem[];
};

const activityDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatActivityDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return activityDateFormatter.format(parsed);
}

export function ConversationsList({
  initialConversations,
}: ConversationsListProps) {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const [conversations, setConversations] = useState(initialConversations);
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);

  const hasConversations = useMemo(
    () => conversations.length > 0,
    [conversations.length],
  );

  const handleCopyConversationId = async (conversationId: string) => {
    try {
      await navigator.clipboard.writeText(conversationId);
      toast.success("Conversation ID copied");
    } catch {
      toast.error("Failed to copy conversation ID");
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const confirmed = await confirm({
      title: "Delete Conversation",
      description: "Delete this conversation? This cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setDeletingConversationId(conversationId);
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to delete conversation");
      }

      setConversations((prev) =>
        prev.filter((item) => item.id !== conversationId),
      );
      toast.success("Conversation deleted");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete conversation",
      );
    } finally {
      setDeletingConversationId(null);
    }
  };

  if (!hasConversations) {
    return (
      <p className="text-muted-foreground text-center">No conversations yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted"
        >
          <Avatar>
            <AvatarFallback>
              {conversation.contact.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {conversation.contact.name || "Unknown contact"}
            </p>
            <p className="text-sm text-muted-foreground">
              Last activity: {formatActivityDate(conversation.updatedAt)}
            </p>
          </div>

          <Badge variant="outline">{conversation.channel}</Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Conversation options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/conversations/${conversation.id}`}>
                  Open conversation
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyConversationId(conversation.id)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteConversation(conversation.id)}
                disabled={deletingConversationId === conversation.id}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deletingConversationId === conversation.id
                  ? "Deleting..."
                  : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
