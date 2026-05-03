"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, RefreshCcw, Home, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard Error:", error);
  }, [error]);

  const isAuthError = error.message?.toLowerCase().includes("auth") ||
                      error.message?.toLowerCase().includes("unauthorized") ||
                      error.message?.toLowerCase().includes("login");

  const isNetworkError = error.message?.toLowerCase().includes("fetch") ||
                         error.message?.toLowerCase().includes("network") ||
                         error.message?.toLowerCase().includes("timeout");

  return (
    <div className="flex flex-1 items-center justify-center p-4 min-h-[400px]">
      <Card className="max-w-md w-full border-destructive/20 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">
            {isAuthError ? "Authentication Issue" : isNetworkError ? "Network Connection Lost" : "Something went wrong"}
          </CardTitle>
          <CardDescription>
            {isAuthError
              ? "Your session may have expired. Please try logging in again."
              : isNetworkError
              ? "We're having trouble connecting to our servers. Please check your internet connection."
              : "We encountered an unexpected error while loading this page. Our team has been notified."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md mx-6 mb-6 font-mono overflow-auto max-h-32">
          {error.message || "Unknown error occurred"}
          {error.digest && <div className="mt-2 text-[10px] opacity-50">Error ID: {error.digest}</div>}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={() => reset()} className="w-full gap-2">
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
          <div className="flex gap-2 w-full">
            <Button asChild variant="outline" className="flex-1 gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 gap-2">
              <Link href="https://replybase.co.uk/support" target="_blank">
                <MessageSquare className="h-4 w-4" />
                Support
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
