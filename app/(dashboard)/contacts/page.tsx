import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContactsList } from "@/components/contacts/contacts-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacts",
};

async function getContacts(tenantId: string) {
  console.log("[getContacts] tenantId:", tenantId);
  if (!tenantId) {
    console.warn("[getContacts] No tenantId provided, returning empty array.");
    return [];
  }
  const contacts = await prisma.contact.findMany({
    where: { tenantId },
    include: {
      conversations: {
        select: { id: true, channel: true, updatedAt: true },
        orderBy: { updatedAt: Prisma.SortOrder.desc },
      },
      identities: { select: { type: true, value: true } },
    },
    orderBy: { createdAt: Prisma.SortOrder.desc },
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
        <ContactsList
          initialContacts={contacts.map((contact: any) => ({
            id: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            identities: contact.identities || [],
            conversations: (contact.conversations || []).map(
              (conversation: any) => ({
                id: conversation.id,
                channel: conversation.channel,
                updatedAt:
                  conversation.updatedAt instanceof Date
                    ? conversation.updatedAt.toISOString()
                    : conversation.updatedAt,
              }),
            ),
          }))}
        />
      </CardContent>
    </Card>
  );
}
