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

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Contacts",
};

async function getContacts(tenantId: string) {
  const contacts = await prisma.contact.findMany({
    where: {
      tenantId,
    },
    include: {
      conversations: {
        select: {
          id: true,
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
            contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarFallback>
                      {contact.name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{contact.name || "Unknown"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {contact.email && (
                        <p className="text-sm text-muted-foreground">
                          {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground">
                          {contact.phone}
                        </p>
                      )}
                    </div>
                    {contact.identities.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {contact.identities.map((identity, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            {identity.type}
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
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
