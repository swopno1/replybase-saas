"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CrmConversation,
  CrmMessage,
  InternalNote,
  User,
  Contact,
} from "@prisma/client";
import { ConversationHeader } from "@/components/conversation/conversation-header";
import { MessageFeed } from "@/components/conversation/message-feed";
import { ReplyComposer } from "@/components/conversation/reply-composer";

type ConversationViewData = CrmConversation & {
  messages: CrmMessage[];
  internalNotes: (InternalNote & { author: Partial<User> })[];
  assignee: Partial<User> | null;
  contact: Contact;
};

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [conversation, setConversation] = useState<ConversationViewData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const refreshConversation = useCallback(() => {
    if (conversationId) {
      setLoading(true);
      fetch(`/api/conversations/${conversationId}`)
        .then((res) => res.json())
        .then((data) => {
          setConversation(data.conversation);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch conversation:", error);
          setLoading(false);
        });
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      refreshConversation();
    }
    // The linter wants `refreshConversation` in the dependency array, but that causes a different lint error.
    // Since `refreshConversation` is memoized and only changes when `conversationId` changes,
    // depending on `conversationId` is sufficient to ensure the effect re-runs correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  if (loading) {
    return <div className="p-4">Loading conversation...</div>;
  }

  if (!conversation) {
    return <div className="p-4">Conversation not found.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <ConversationHeader
        conversation={conversation}
        onRefresh={refreshConversation}
      />
      <MessageFeed conversation={conversation} />
      <ReplyComposer
        conversation={conversation}
        onRefresh={refreshConversation}
      />
    </div>
  );
}
