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
import { ContactsList } from "@/components/contacts/contacts-list";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contacts",
};

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contacts</CardTitle>
        <CardDescription>
          Manage your contacts and view their conversation history.
          <a 
            href="https://replybase.co.uk/docs/platform" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-2 text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
          >
            Guide: Learn more about CRM <ExternalLink className="h-2 w-2" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContactsList />
      </CardContent>
    </Card>
  );
}
