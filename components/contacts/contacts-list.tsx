"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Mail, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
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
import Link from "next/link";

type ContactIdentity = { type: string; value: string };
type ContactConversation = { id: string; channel: string; updatedAt: string };

type ContactListItem = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  identities: ContactIdentity[];
  conversations: ContactConversation[];
  createdAt: string;
};

function formatIdentityLabel(type: string) {
  if (type === "webchat_visitor_id") return "Webchat visitor";
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVisitorDisplayName(contact: ContactListItem) {
  if (contact.name?.trim()) return contact.name.trim();
  if (contact.email?.trim()) return contact.email.trim();
  if (contact.phone?.trim()) return contact.phone.trim();

  const visitorIdentity = contact.identities.find(
    (identity) => identity.type === "webchat_visitor_id",
  );

  if (visitorIdentity?.value) {
    return `Website Visitor ${visitorIdentity.value.slice(-6).toUpperCase()}`;
  }

  return "Unknown Visitor";
}

export function ContactsList() {
  const router = useRouter();
  const { confirm } = useConfirmation();
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: (pagination.pageIndex + 1).toString(),
        limit: pagination.pageSize.toString(),
      });
      const response = await fetch(`/api/contacts?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || [];
        const metadata = result.metadata || {};
        
        setContacts(data);
        setTotalCount(metadata.totalCount || 0);
        setPageCount(metadata.totalPages || 0);
        setIsAllMatchingSelected(false);
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [pagination]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleDeleteContacts = async (ids: string[], allMatching = false) => {
    const message = allMatching
      ? `Are you sure you want to delete ALL ${totalCount} matching contacts? Related conversation links may be removed.`
      : `Are you sure you want to delete ${ids.length} contact(s)? Related conversation links may be removed.`;

    const confirmed = await confirm({
      title: "Delete Contacts",
      description: message,
      confirmText: "Delete",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const response = await fetch("/api/contacts", {
        method: "DELETE",
        body: JSON.stringify({ ids: allMatching ? "ALL" : ids }),
      });

      if (!response.ok) throw new Error("Failed to delete contacts");

      toast.success(`${ids.length} contact(s) deleted`);
      setRowSelection({});
      fetchContacts();
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete contacts");
    }
  };

  const columns = useMemo<ColumnDef<ContactListItem>[]>(() => [
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
      accessorKey: "name",
      header: "Contact",
      cell: ({ row }) => {
        const displayName = getVisitorDisplayName(row.original);
        const avatarLabel = displayName.charAt(0)?.toUpperCase() || "?";
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{avatarLabel}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{displayName}</span>
              <span className="text-xs text-muted-foreground">
                {row.original.email || row.original.phone || "Anonymous"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "identities",
      header: "Identities",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.identities.map((id, idx) => (
            <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0 h-4">
              {formatIdentityLabel(id.type)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "conversations",
      header: "Conversations",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.conversations.length} conversation{row.original.conversations.length !== 1 ? "s" : ""}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const latestConversation = row.original.conversations[0];
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {latestConversation && (
                  <DropdownMenuItem asChild>
                    <Link href={`/conversations/${latestConversation.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Open chat
                    </Link>
                  </DropdownMenuItem>
                )}
                {row.original.email && (
                  <DropdownMenuItem asChild>
                    <a href={`mailto:${row.original.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email contact
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleDeleteContacts([row.original.id])} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], []);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const currentSelectionCount = isAllMatchingSelected ? totalCount : selectedIds.length;

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="destructive" size="sm" onClick={() => handleDeleteContacts(selectedIds, isAllMatchingSelected)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({currentSelectionCount})
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={contacts}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        isLoading={loading}
        persistenceKey="contacts_table"
        totalCount={totalCount}
        onSelectAllMatching={setIsAllMatchingSelected}
        isAllMatchingSelected={isAllMatchingSelected}
      />
    </div>
  );
}
