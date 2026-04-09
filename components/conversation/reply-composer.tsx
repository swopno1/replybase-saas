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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submitTo = async (path: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }

      setContent("");
      onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send update",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = () =>
    submitTo(`/api/conversations/${conversation.id}/messages`);

  const handleNote = () =>
    submitTo(`/api/conversations/${conversation.id}/notes`);

  return (
    <div className="p-4 border-t">
      {conversation.channel === "web" ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Sending a live reply pauses bot automation for this webchat
          conversation.
        </p>
      ) : null}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your reply or note..."
        className="mb-2"
      />
      {errorMessage ? (
        <p className="mb-2 text-sm text-red-600">{errorMessage}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleNote}
          variant="outline"
          disabled={isSubmitting || !content.trim()}
        >
          Add Note
        </Button>
        <Button
          onClick={handleReply}
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting ? "Sending..." : "Send Reply"}
        </Button>
      </div>
    </div>
  );
}
