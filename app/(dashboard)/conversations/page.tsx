import { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
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
  title: "Conversations",
};

async function getConversations(tenantId: string) {
  const conversations = await prisma.crmConversation.findMany({
    where: {
      contact: {
        tenantId,
      },
    },
    include: {
      contact: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100, // Limit to 100 conversations for performance
  });
  return conversations;
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
        <div className="space-y-2">
          {conversations.map((convo) => (
            <Link
              href={`/conversations/${convo.id}`}
              key={convo.id}
              className="block p-4 border rounded-lg hover:bg-muted"
            >
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarFallback>
                    {convo.contact.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{convo.contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Last activity:{" "}
                    {new Date(convo.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">{convo.channel}</Badge>
              </div>
            </Link>
          ))}
          {conversations.length === 0 && (
            <p className="text-muted-foreground text-center">
              No conversations yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
