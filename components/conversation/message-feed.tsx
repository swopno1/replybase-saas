"use client";

import { useEffect, useRef } from "react";
import {
  CrmConversation,
  CrmMessage,
  InternalNote,
  User,
  Contact,
} from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type MessageWithAuthor = CrmMessage & { author?: Partial<User> };
type NoteWithAuthor = InternalNote & { author: Partial<User> };

type ConversationViewData = CrmConversation & {
  messages: MessageWithAuthor[];
  internalNotes: NoteWithAuthor[];
  contact: Contact;
};

export function MessageFeed({
  conversation,
}: {
  conversation: ConversationViewData;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const combinedFeed = [
    ...conversation.messages,
    ...conversation.internalNotes,
  ].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [combinedFeed.length]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      {combinedFeed.map((item) =>
        "direction" in item ? (
          <Message
            key={item.id}
            message={item}
            contact={conversation.contact}
          />
        ) : (
          <Note key={item.id} note={item} />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function Message({
  message,
  contact,
}: {
  message: MessageWithAuthor;
  contact: { name: string | null };
}) {
  const isOutbound = message.direction === "outbound";
  const authorName = isOutbound ? "You" : contact.name || "Unknown";
  const authorImage = ""; // No image available

  return (
    <div
      className={`flex items-start gap-4 ${isOutbound ? "justify-end" : ""}`}
    >
      {!isOutbound && (
        <Avatar>
          <AvatarImage src={authorImage} />
          <AvatarFallback>{authorName.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`rounded-lg p-3 ${
          isOutbound ? "bg-blue-500 text-white" : "bg-gray-200"
        }`}
      >
        <p className="text-sm">{message.content}</p>
      </div>
      {isOutbound && (
        <Avatar>
          <AvatarImage src={authorImage} />
          <AvatarFallback>Y</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function Note({ note }: { note: NoteWithAuthor }) {
  return (
    <div className="flex justify-center my-6">
      <div className="max-w-[80%] bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm relative">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">
            Internal Note
          </span>
          <span className="text-[10px] text-yellow-600">
            • {new Date(note.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="text-sm text-yellow-900 italic leading-relaxed">
          "{note.content}"
        </div>
        <div className="mt-2 text-xs font-medium text-yellow-700 flex items-center gap-1">
          <Avatar className="w-4 h-4">
            <AvatarImage src={note.author.image ?? ""} />
            <AvatarFallback className="text-[8px] bg-yellow-200">
              {note.author.name?.charAt(0) ?? "U"}
            </AvatarFallback>
          </Avatar>
          {note.author.name || "Unknown Team Member"}
        </div>
      </div>
    </div>
  );
}
