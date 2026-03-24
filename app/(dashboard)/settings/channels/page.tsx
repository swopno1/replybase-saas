import { getServerSession } from "next-auth/next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { authOptions } from "@/lib/auth";
import { ChannelsClient } from "./channels-client";

export default async function ChannelsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Channel Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Enable or disable communication channels for your bots
        </p>
      </div>

      <Separator className="my-4" />

      {/* Channel Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Channels</CardTitle>
          <CardDescription>
            Manage which communication channels are available for your bots to
            use. Channels disabled at the system level cannot be enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelsClient />
        </CardContent>
      </Card>

      <div className="p-4 bg-muted/50 rounded-lg text-sm">
        <h4 className="font-semibold mb-2">Channel Status Legend</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">✓ Available:</strong> Channel is
            enabled and ready to use
          </li>
          <li>
            <strong className="text-foreground">⊗ Disabled:</strong> Channel is
            disabled and cannot be used
          </li>
          <li>
            <strong className="text-foreground">⚠ System Disabled:</strong>{" "}
            Channel is disabled at the system level and cannot be enabled
          </li>
        </ul>
      </div>
    </div>
  );
}
