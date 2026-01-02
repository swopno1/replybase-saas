
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { BotpressService } from "@/lib/botpress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Activity, ShieldCheck, AlertCircle } from "lucide-react";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const health = await BotpressService.getHealth();
    const isEngineUp = !!health;

    return (
        <>
            <div>
                <h1 className="text-3xl font-bold">Welcome, {session?.user?.name || "User"}</h1>
                <p className="text-muted-foreground">Manage your bots and integrations.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Engine Status</CardTitle>
                        {isEngineUp ? <Activity className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{isEngineUp ? "Online" : "Offline"}</div>
                        <p className="text-xs text-muted-foreground">
                            {health?.version ? `v${health.version}` : "Connection failed"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Account</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Standard</div>
                        <p className="text-xs text-muted-foreground">
                            {session?.user?.email}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Integrations</CardTitle>
                        <MessageIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Facebook</div>
                        <p className="text-xs text-muted-foreground mb-4">
                            Connect your pages
                        </p>
                        <Link href="/dashboard/integrations/facebook">
                            <Button size="sm" variant="outline" className="w-full">
                                Manage
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Debug Info for MVP */}
            <Card className="mt-8 border-dashed">
                <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">MVP Debug Info</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs bg-slate-100 p-2 rounded overflow-auto">
                        {JSON.stringify({ session, engineHealth: health }, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </>
    );
}

function MessageIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
    )
}
