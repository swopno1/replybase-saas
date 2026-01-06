import { BotList } from '@/components/bot-list';

export default function BotsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bots</h1>
        <p className="text-gray-600">Manage your AI bots and channels</p>
      </div>
      <BotList />
    </div>
  );
}
