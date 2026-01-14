"use client";

import { CrmConversation } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReplyComposer({
  conversation,
  onRefresh,
}: {
  conversation: CrmConversation;
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");

  const handleReply = () => {
    fetch(`/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then(() => {
      setContent("");
      onRefresh();
    });
  };

  const handleNote = () => {
    fetch(`/api/conversations/${conversation.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then(() => {
      setContent("");
      onRefresh();
    });
  };

  return (
    <div className="p-4 border-t">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your reply or note..."
        className="mb-2"
      />
      <div className="flex justify-end gap-2">
        <Button onClick={handleNote} variant="outline">
          Add Note
        </Button>
        <Button onClick={handleReply}>Send Reply</Button>
      </div>
    </div>
  );
}
