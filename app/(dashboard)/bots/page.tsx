"use client";

import { BotList } from "@/components/bot-list";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Page for managing bot records and channel routing.
 */
export default function BotsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bots</h1>
          <p className="text-gray-600 flex flex-wrap items-center gap-1.5">
            Manage bot records and channel routing. Runtime response mode is
            configured in channel integrations.
            <a 
              href="https://replybase.co.uk/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-500 font-semibold hover:underline inline-flex items-center gap-1 ml-1"
            >
              Docs <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        </div>
      </div>
      <BotList />
    </div>
  );
}
