"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, Copy, MessageSquare } from "lucide-react";
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
import { DataTable } from "@/components/data-table";
import { ColumnDef, PaginationState, RowSelectionState } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";

type ConversationListItem = {
  id: string;
  channel: string;
  updatedAt: string;
  contact: {
    id: string;
    name: string | null;
  };
};

const activityDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatActivityDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return activityDateFormatter.format(parsed);
}

export function ConversationsList() {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: (pagination.pageIndex + 1).toString(),
        limit: pagination.pageSize.toString(),
      });
      const response = await fetch(`/api/conversations?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || [];
        const metadata = result.metadata || {};

        setConversations(data);
        setTotalCount(metadata.totalCount || 0);
        setPageCount(metadata.totalPages || 0);
        setIsAllMatchingSelected(false);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchConversations();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchConversations]);

  const handleCopyConversationId = async (conversationId: string) => {
    try {
      await navigator.clipboard.writeText(conversationId);
      toast.success("Conversation ID copied");
    } catch {
      toast.error("Failed to copy conversation ID");
    }
  };

  const handleDeleteConversations = async (ids: string[], allMatching = false) => {
    const message = allMatching
      ? `Are you sure you want to delete ALL ${totalCount} matching conversations? This cannot be undone.`
      : `Are you sure you want to delete ${ids.length} conversation(s)? This cannot be undone.`;

    const confirmed = await confirm({
      title: "Delete Conversations",
      description: message,
      confirmText: "Delete",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const response = await fetch("/api/conversations", {
        method: "DELETE",
        body: JSON.stringify({ ids: allMatching ? "ALL" : ids }),
      });

      if (!response.ok) throw new Error("Failed to delete conversations");

      toast.success(`${ids.length} conversation(s) deleted`);
      setRowSelection({});
      fetchConversations();
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete conversations");
    }
  };

  const columns = useMemo<ColumnDef<ConversationListItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "contact.name",
      header: "Contact",
      cell: ({ row }) => {
        const name = row.original.contact.name || "Unknown contact";
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{name.charAt(0) || "?"}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ row }) => <Badge variant="outline">{row.original.channel}</Badge>,
    },
    {
      accessorKey: "updatedAt",
      header: "Last Activity",
      cell: ({ row }) => formatActivityDate(row.original.updatedAt),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Conversation actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/conversations/${row.original.id}`}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open chat
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyConversationId(row.original.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteConversations([row.original.id])}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], []);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const currentSelectionCount = isAllMatchingSelected ? totalCount : selectedIds.length;

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={conversations}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        isLoading={loading}
        persistenceKey="conversations_table"
        totalCount={totalCount}
        onSelectAllMatching={setIsAllMatchingSelected}
        isAllMatchingSelected={isAllMatchingSelected}
        actionButtons={
          selectedIds.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteConversations(selectedIds, isAllMatchingSelected)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({currentSelectionCount})
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
