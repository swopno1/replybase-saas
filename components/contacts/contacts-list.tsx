"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Mail, Phone } from "lucide-react";
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

type ContactIdentity = { type: string; value: string };
type ContactConversation = { id: string; channel: string; updatedAt: string };

type ContactListItem = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  identities: ContactIdentity[];
  conversations: ContactConversation[];
};

type ContactsListProps = {
  initialContacts: ContactListItem[];
};

function formatIdentityLabel(type: string) {
  if (type === "webchat_visitor_id") {
    return "Webchat visitor";
  }

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

export function ContactsList({ initialContacts }: ContactsListProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(
    null,
  );

  const handleDeleteContact = async (contactId: string) => {
    const confirmed = window.confirm(
      "Delete this contact? Related conversation links may be removed.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingContactId(contactId);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "Failed to delete contact");
      }

      setContacts((prev) => prev.filter((item) => item.id !== contactId));
      toast.success("Contact deleted");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete contact",
      );
    } finally {
      setDeletingContactId(null);
    }
  };

  if (contacts.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No contacts yet. Contacts will appear here when people start
        conversations.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {contacts.map((contact) => {
        const latestConversation = contact.conversations[0];
        const displayName = getVisitorDisplayName(contact);
        const avatarLabel = displayName.charAt(0)?.toUpperCase() || "?";

        return (
          <div
            key={contact.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center space-x-4 min-w-0">
              <Avatar>
                <AvatarFallback>{avatarLabel}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold truncate">{displayName}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {contact.email ? (
                    <p className="text-sm text-muted-foreground">
                      {contact.email}
                    </p>
                  ) : null}
                  {contact.phone ? (
                    <p className="text-sm text-muted-foreground">
                      {contact.phone}
                    </p>
                  ) : null}
                  {!contact.email && !contact.phone ? (
                    <p className="text-sm text-muted-foreground">
                      Anonymous website visitor
                    </p>
                  ) : null}
                </div>
                {contact.identities.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {contact.identities.map((identity, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {formatIdentityLabel(identity.type)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {contact.conversations.length} conversation
                {contact.conversations.length !== 1 ? "s" : ""}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Contact options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {latestConversation ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/conversations/${latestConversation.id}`}>
                        Open chat
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {contact.email ? (
                    <DropdownMenuItem asChild>
                      <a href={`mailto:${contact.email}`}>
                        <Mail className="mr-2 h-4 w-4" />
                        Email contact
                      </a>
                    </DropdownMenuItem>
                  ) : null}
                  {contact.phone ? (
                    <DropdownMenuItem asChild>
                      <a href={`tel:${contact.phone}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call contact
                      </a>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => handleDeleteContact(contact.id)}
                    disabled={deletingContactId === contact.id}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingContactId === contact.id
                      ? "Deleting..."
                      : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
