"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlausibleDashboard({ sharedLink }: { sharedLink?: string }) {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "app.replybase.co.uk";

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Analytics Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time traffic and event analytics from Plausible.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://plausible.io/${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            Open Plausible <ExternalLink size={14} />
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {sharedLink ? (
          <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border">
            <iframe
              src={`${sharedLink}&embed=true&theme=light`}
              loading="lazy"
              className="h-full w-full"
              style={{ border: 0 }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed">
            <p className="text-gray-500 mb-4">Plausible shared link not configured or not accessible.</p>
            <Button variant="outline" asChild>
              <a
                href={`https://plausible.io/${domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Plausible.io
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
