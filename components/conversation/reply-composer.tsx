"use client";

import { CrmConversation } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ReplyComposer({
  conversation,
  onRefresh,
}: {
  conversation: CrmConversation;
  onRefresh: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
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

  const handleSuggestReply = async () => {
    setIsSuggesting(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/suggest-reply`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestion");
      }

      const data = await response.json();
      setContent(data.suggestion);
      toast.success("AI suggestion generated");
    } catch (error) {
      toast.error("Could not generate suggestion");
      console.error(error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSubmitting && content.trim()) {
        handleReply();
      }
    }
  };

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
        onKeyDown={handleKeyDown}
        placeholder="Type your reply or note… (Enter to send, Shift+Enter for new line)"
        className="mb-2"
      />
      {errorMessage ? (
        <p className="mb-2 text-sm text-red-600">{errorMessage}</p>
      ) : null}
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSuggestReply}
          disabled={isSuggesting || isSubmitting}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          {isSuggesting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Suggest AI Reply
        </Button>

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
