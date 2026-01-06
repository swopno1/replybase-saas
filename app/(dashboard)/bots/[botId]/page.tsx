'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Bot {
  id: string;
  name: string;
  channel: string;
  status: boolean;
  createdAt: string;
}

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Bot | null>(null);

  useEffect(() => {
    const fetchBot = async () => {
      try {
        const res = await fetch(`/api/bots/${botId}`);
        const data = await res.json();
        setBot(data);
        setFormData(data);
      } catch (error) {
        console.error('Failed to fetch bot:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBot();
  }, [botId]);

  const handleSave = async () => {
    if (!formData) return;

    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const updated = await res.json();
        setBot(updated);
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to update bot:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!bot) return <div>Bot not found</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">{bot.name}</h1>

      <div className="border rounded-lg p-6 space-y-4">
        {editing ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Bot Name</label>
              <Input
                value={formData?.name || ''}
                onChange={(e) => setFormData(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData?.status ?? false}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, status: e.target.checked } : null)}
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save Changes</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-gray-600">Channel</p>
              <p className="font-medium">{bot.channel}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-2 py-1 rounded text-sm ${
                bot.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {bot.status ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="pt-4">
              <h3 className="font-medium mb-4">Flow Builder</h3>
              <p className="text-gray-600 text-sm mb-4">Visual flow builder coming soon. For now, configure your bot via API or webhooks.</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="destructive">Delete Bot</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}