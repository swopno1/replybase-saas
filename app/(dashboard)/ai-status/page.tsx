import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { BotpressService } from "@/lib/botpress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { AIToggle } from "@/components/ai-toggle";
import { authOptions } from "@/lib/auth";

export default async function AIStatusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  const userId = session.user.id;

  // Get engine health
  const health = await BotpressService.getHealth();
  const isEngineUp = !!health;

  // Get connected Facebook pages
  const connectedPages = userId
    ? await prisma.facebookPage.findMany({
      where: { userId },
      select: {
        id: true,
        facebookId: true,
        name: true,
        engineConnected: true,
        botId: true,
      },
      orderBy: {
        name: "asc",
      },
    })
    : [];

  const activePagesCount = connectedPages.filter(
    (p: { engineConnected: boolean }) => p.engineConnected
  ).length;
  const isAIActive = activePagesCount > 0 && isEngineUp;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">AI Status</h1>
        <p className="text-muted-foreground mt-1">
          Manage AI reply settings for your Facebook Pages
        </p>
      </div>

      {/* Engine Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Engine Connection
          </CardTitle>
          <CardDescription>Status of the AI engine service</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEngineUp ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">Online</div>
                    <div className="text-sm text-muted-foreground">
                      Connected
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium">Offline</div>
                    <div className="text-sm text-muted-foreground">
                      Engine is not responding
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Reply Status
          </CardTitle>
          <CardDescription>
            {isAIActive
              ? "AI is actively replying to messages"
              : "AI replies are currently disabled"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isAIActive ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium text-lg">Active</div>
                    <div className="text-sm text-muted-foreground">
                      {activePagesCount} of {connectedPages.length} page
                      {connectedPages.length !== 1 ? "s" : ""} enabled
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-lg">Inactive</div>
                    <div className="text-sm text-muted-foreground">
                      Enable AI for your pages below
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Pages */}
      {connectedPages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Pages Connected</CardTitle>
            <CardDescription>
              Connect a Facebook Page to enable AI replies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/integrations/facebook">
              <Button>Connect Facebook Page</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Facebook Pages</CardTitle>
            <CardDescription>
              Enable or disable AI replies for each page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectedPages.map((page: { id: string; name: string; engineConnected: boolean; facebookId: string; botId: string | null }) => (
              <div
                key={page.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{page.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {page.engineConnected ? (
                        <span className="text-green-600">AI Enabled</span>
                      ) : (
                        <span className="text-muted-foreground">
                          AI Disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <AIToggle
                  pageId={page.id}
                  facebookId={page.facebookId}
                  enabled={page.engineConnected}
                  botId={page.botId}
                  disabled={!isEngineUp}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            When AI is enabled for a page, ReplyBase will automatically respond
            to incoming Facebook Messenger messages using AI.
          </p>
          <p>
            The engine must be online for AI replies to work. If the engine is
            offline, you&apos;ll see a warning above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
