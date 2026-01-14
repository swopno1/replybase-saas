import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

async function getConversationDetails(
  conversationId: string,
  tenantId: string
) {
  const conversation = await prisma.crmConversation.findFirst({
    where: {
      id: conversationId,
      contact: {
        tenantId: tenantId,
      },
    },
    include: {
      contact: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
  return conversation;
}

export default async function ConversationDetailPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return notFound();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return notFound();
  }

  const conversation = await getConversationDetails(
    params.conversationId,
    user.tenantId
  );

  if (!conversation) {
    return notFound();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <Link
          href="/conversations"
          className="flex items-center text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Conversations
        </Link>
      </div>
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center space-x-4 border-b">
          <Avatar>
            <AvatarFallback>
              {conversation.contact.name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{conversation.contact.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {conversation.channel}
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${
                message.direction === "outbound"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${
                  message.direction === "outbound"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs text-right mt-1 opacity-75">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {conversation.messages.length === 0 && (
            <p className="text-center text-muted-foreground">
              No messages in this conversation yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
