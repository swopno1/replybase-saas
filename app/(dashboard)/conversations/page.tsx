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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <CardDescription>
          View all conversations with your contacts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConversationsList />
      </CardContent>
    </Card>
  );
}
