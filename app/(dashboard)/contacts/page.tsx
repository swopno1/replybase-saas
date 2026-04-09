import Link from "next/link";
import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacts",
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

function getVisitorDisplayName(contact: {
  name: string | null;
  email: string | null;
  phone: string | null;
  identities: Array<{ type: string; value: string }>;
}) {
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

async function getContacts(tenantId: string) {
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
    },
    include: {
      conversations: {
        select: {
          id: true,
          channel: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
      identities: {
        select: {
          type: true,
          value: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });
  return contacts;
}

export default async function ContactsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return <p>Tenant not found.</p>;
  }

  const contacts = await getContacts(user.tenantId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        <CardDescription>
          Manage your contacts and view their conversation history
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No contacts yet. Contacts will appear here when people start
              conversations.
            </p>
          ) : (
            contacts.map((contact) => {
              const latestConversation = contact.conversations[0];
              const displayName = getVisitorDisplayName(contact);
              const avatarLabel = displayName.charAt(0)?.toUpperCase() || "?";

              return (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarFallback>{avatarLabel}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{displayName}</p>
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
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs"
                            >
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
                    {latestConversation ? (
                      <Link
                        href={`/conversations/${latestConversation.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Open chat
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
