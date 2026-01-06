'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface Bot {
  id: string;
  name: string;
  channel: string;
  status: boolean;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  bots: Bot[];
}

export function BotList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBots = async () => {
      try {
        const res = await fetch('/api/bots');
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error('Failed to fetch bots:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBots();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No projects yet. Create one to get started.</p>
          <Link href="/dashboard/bots/new">
            <Button><Plus className="mr-2 h-4 w-4" />Create Project</Button>
          </Link>
        </div>
      ) : (
        projects.map(project => (
          <div key={project.id} className="border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <Link href={`/dashboard/bots/new?projectId=${project.id}`}>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Bot</Button>
              </Link>
            </div>

            {project.bots.length === 0 ? (
              <p className="text-gray-500 text-sm">No bots in this project yet.</p>
            ) : (
              <div className="space-y-2">
                {project.bots.map(bot => (
                  <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
                    <div className="border rounded p-4 hover:bg-gray-50 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{bot.name}</p>
                          <p className="text-sm text-gray-600">{bot.channel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            bot.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {bot.status ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}