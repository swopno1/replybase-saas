import { BotList } from '@/components/bot-list';

export default function BotsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bots</h1>
          <p className="text-gray-600">Manage your AI bots and channels</p>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_TYPEBOT_BUILDER_URL || "https://engine.replybase.co.uk"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
        >
          Launch Builder ↗
        </a>
      </div>
      <BotList />
    </div>
  );
}
