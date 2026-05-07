"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirmation } from "@/components/ui/confirmation-provider";

interface CreateBotFormProps {
  projectId: string;
}

export function CreateBotForm({ projectId }: CreateBotFormProps) {
  const router = useRouter();
  const { alert } = useConfirmation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    channel: "web",
    status: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
        }),
      });

      if (res.ok) {
        router.push("/bots");
      } else {
        await alert({
          title: "Failed to Create Bot",
          description: "Please check your input and try again.",
        });
      }
    } catch (error) {
      console.error("Error creating bot:", error);
      await alert({
        title: "Unexpected Error",
        description: "An error occurred while creating the bot.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">Bot Name</label>
        <Input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My awesome bot"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Primary Channel</label>
        <select
          value={formData.channel}
          onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
          className="w-full px-3 py-2 border rounded-md"
        >
          <option value="web">Web Chat</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
          />
          <span className="text-sm">Enable bot</span>
        </label>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating..." : "Create Bot"}
      </Button>
    </form>
  );
}
