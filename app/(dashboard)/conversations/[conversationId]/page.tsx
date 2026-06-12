"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CrmConversation,
  CrmMessage,
  InternalNote,
  User,
  Contact,
  Lead,
} from "@prisma/client";
import { ConversationHeader } from "@/components/conversation/conversation-header";
import { MessageFeed } from "@/components/conversation/message-feed";
import { ReplyComposer } from "@/components/conversation/reply-composer";
import { ConversationSkeleton } from "@/components/conversation/conversation-skeleton";

export const dynamic = "force-dynamic";

type ConversationViewData = CrmConversation & {
  messages: CrmMessage[];
  internalNotes: (InternalNote & { author: Partial<User> })[];
  assignee: Partial<User> | null;
  contact: Contact & { leads?: Lead[] };
  webChatSessions?: Array<{
    id: string;
    visitorId: string;
    lastSeenAt: string | Date;
    site?: {
      id: string;
      name: string;
    } | null;
  }>;
};

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [conversation, setConversation] = useState<ConversationViewData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const refreshConversation = useCallback(() => {
    if (conversationId) {
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
    if (!conversationId) {
      return;
    }

    const timeoutId = setTimeout(() => setLoading(true), 0);
    refreshConversation();

    const intervalId = window.setInterval(() => {
      refreshConversation();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
      if (typeof timeoutId !== "undefined") clearTimeout(timeoutId);
    };
  }, [conversationId, refreshConversation]);

  if (loading) {
    return <ConversationSkeleton />;
  }

  if (!conversation) {
    return <div className="p-4">Conversation not found.</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
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
