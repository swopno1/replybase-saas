"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function CreateBotContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    channel: "facebook",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For now, just redirect back to bots page
      // Bot creation happens through the Typebot builder
      router.push("/bots");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bots">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bots
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create New Bot</h1>
        <p className="text-gray-600">
          Create a new bot and start building conversations
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Bot Information</CardTitle>
          <CardDescription>
            Configure your bot settings. You can edit these later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Bot Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="My Bot"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Give your bot a descriptive name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Channel</label>
              <select
                value={formData.channel}
                onChange={(e) =>
                  setFormData({ ...formData, channel: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the primary channel for this bot
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm text-blue-800">
                <strong>Next:</strong> After creating your bot, you&apos;ll be
                able to configure it using our visual builder.
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !formData.name}>
                {loading ? "Creating..." : "Create Bot"}
              </Button>
              <Link href="/bots">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreateBotPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateBotContent />
    </Suspense>
  );
}
