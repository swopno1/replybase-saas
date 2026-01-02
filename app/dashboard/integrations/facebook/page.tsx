"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface FBPage {
    id: string;
    name: string;
    access_token: string;
    category: string;
    connected?: boolean;
    engineConnected?: boolean;
}

export default function FacebookIntegrationPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [pages, setPages] = useState<FBPage[]>([]);
    const [connected, setConnected] = useState(false);
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchPages();
    }, []);

    const fetchPages = async () => {
        try {
            const res = await fetch("/api/integrations/facebook/pages");
            const data = await res.json();
            if (data.connected) {
                setConnected(true);
                setPages(data.pages || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectPage = async (page: FBPage) => {
        setStatusMap(prev => ({ ...prev, [page.id]: "loading" }));

        try {
            // Send page information to backend for connection
            const res = await fetch("/api/integrations/facebook", {
                method: "POST",
                body: JSON.stringify({
                    pageId: page.id,
                    pageName: page.name,
                    accessToken: page.access_token,
                    accessTokenOnly: true
                }),
                headers: { "Content-Type": "application/json" }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to connect page");
            }

            setStatusMap(prev => ({ ...prev, [page.id]: "success" }));
            // Refresh pages to show updated connection status
            await fetchPages();
        } catch (error) {
            console.error("Error connecting page:", error);
            setStatusMap(prev => ({ ...prev, [page.id]: "error" }));
        }
    };

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Facebook Integration</h1>

            {!connected ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Connect Account</CardTitle>
                        <CardDescription>Link your Facebook account to manage pages.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => signIn("facebook")}>Connect with Facebook</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Connected Pages</CardTitle>
                            <CardDescription>Select pages to connect with ReplyBase Engine.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pages.length === 0 ? (
                                <p className="text-muted-foreground">No pages found for this account.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {pages.map(page => {
                                        const isConnected = page.engineConnected || statusMap[page.id] === "success";
                                        const isLoading = statusMap[page.id] === "loading";
                                        const isError = statusMap[page.id] === "error";
                                        
                                        return (
                                            <div key={page.id} className="flex items-center justify-between border p-4 rounded-lg">
                                                <div>
                                                    <div className="font-semibold">{page.name}</div>
                                                    <div className="text-xs text-muted-foreground">{page.category}</div>
                                                    {isConnected && (
                                                        <div className="text-xs text-green-600 mt-1">✓ Engine Connected</div>
                                                    )}
                                                    {isError && (
                                                        <div className="text-xs text-red-600 mt-1">✗ Connection Failed</div>
                                                    )}
                                                </div>
                                                <Button
                                                    variant={isConnected ? "secondary" : "default"}
                                                    disabled={isLoading || isConnected}
                                                    onClick={() => handleConnectPage(page)}
                                                >
                                                    {isLoading ? "Connecting..." :
                                                        isConnected ? "Connected" : "Connect"}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button variant="outline" onClick={() => signIn("facebook")}>Re-connect Facebook</Button>
                </div>
            )}
        </div>
    );
}
