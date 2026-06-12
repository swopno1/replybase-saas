"use client";

import { CrmConversation } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/client-analytics";
import { WhatsAppTemplatePicker } from "@/components/conversation/whatsapp-template-picker";

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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const isWhatsApp = conversation.channel === "whatsapp";
  const hasBot = Boolean(conversation.botId);

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
        // Auto-open template picker when outside the 24-hour WhatsApp window
        if (response.status === 409 && isWhatsApp && hasBot) {
          setShowTemplatePicker(true);
        }
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

  const handleReply = () => {
    trackEvent("first_message_sent", {
      onceKey: "first_message_sent",
      onceScope: "local",
    });
    submitTo(`/api/conversations/${conversation.id}/messages`);
  };

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
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch suggestion");
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
    <div className="p-4 border-t space-y-3">
      {showTemplatePicker && isWhatsApp && conversation.botId ? (
        <WhatsAppTemplatePicker
          conversationId={conversation.id}
          botId={conversation.botId}
          onSent={() => {
            setShowTemplatePicker(false);
            setErrorMessage("");
            onRefresh();
          }}
          onCancel={() => setShowTemplatePicker(false)}
        />
      ) : (
        <>
          {conversation.channel === "web" ? (
            <p className="text-xs text-muted-foreground">
              Sending a live reply pauses bot automation for this webchat conversation.
            </p>
          ) : null}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply or note… (Enter to send, Shift+Enter for new line)"
          />
          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSuggestReply}
              disabled={isSuggesting || isSubmitting}
              aria-label="Suggest AI reply"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              {isSuggesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Suggest AI Reply
            </Button>

            <div className="flex items-center gap-2">
              {isWhatsApp && hasBot ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setErrorMessage("");
                    setShowTemplatePicker(true);
                  }}
                  disabled={isSubmitting}
                >
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  Send Template
                </Button>
              ) : null}
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
        </>
      )}
    </div>
  );
}
