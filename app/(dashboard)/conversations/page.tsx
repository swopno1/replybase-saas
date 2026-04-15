import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConversationsList } from "@/components/conversation/conversations-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversations",
};

async function getConversations(tenantId: string) {
  return prisma.crmConversation.findMany({
    where: {
      contact: {
        tenantId,
      },
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100,
  });
}

export default async function ConversationsPage() {
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

  const conversations = await getConversations(user.tenantId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <CardDescription>
          View all conversations with your contacts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConversationsList
          initialConversations={conversations.map((convo) => ({
            id: convo.id,
            channel: convo.channel,
            updatedAt: convo.updatedAt.toISOString(),
            contact: {
              id: convo.contact.id,
              name: convo.contact.name,
            },
          }))}
        />
      </CardContent>
    </Card>
  );
}
