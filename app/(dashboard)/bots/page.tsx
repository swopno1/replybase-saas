"use client";

import { BotList } from "@/components/bot-list";

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
          <p className="text-gray-600">
            Manage bot records and channel routing. Runtime response mode is
            configured in channel integrations.
          </p>
        </div>
      </div>
      <BotList />
    </div>
  );
}
