"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, RefreshCw, User, Bot as BotIcon, Sparkles, Play, Pause } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "bot";
  text: string;
  quickReplies?: Array<{ title: string; payload: string }>;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  onReset: () => void;
  messages: Message[];
  loading: boolean;
  onClientAiReply: () => Promise<void>;
  isAutoPlaying: boolean;
  onToggleAutoPlay: () => void;
  scenarioSteps?: Array<{ message: string }>;
}

export function ChatInterface({
  onSendMessage,
  onReset,
  messages,
  loading,
  onClientAiReply,
  isAutoPlaying,
  onToggleAutoPlay,
  scenarioSteps,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input;
    setInput("");
    await onSendMessage(msg);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <Card className="h-[650px] flex flex-col border border-border shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-3 border-b bg-muted/10">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BotIcon className="h-4 w-4 text-violet-500" />
          Chat Simulator Sandbox
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onReset} disabled={loading} className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-4 bg-background">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-12">
                <Sparkles className="h-8 w-8 mx-auto text-violet-500/40 mb-3 animate-pulse" />
                No messages yet. Select a scenario and use <strong className="text-violet-500">AI Client Reply</strong> or type to start.
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-2 max-w-[85%] ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                    msg.role === "user" 
                      ? "bg-violet-600 text-white shadow-sm" 
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <BotIcon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex flex-col">
                    <div className={`rounded-xl px-3.5 py-2 text-sm shadow-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white font-medium"
                        : "bg-muted text-foreground border border-border/50"
                    }`}>
                      {msg.text}
                    </div>
                    {/* Render Interactive Clickable Quick Replies */}
                    {msg.role === "bot" && msg.quickReplies && msg.quickReplies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.quickReplies.map((qr, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="text-xs py-1 h-7 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500 hover:text-white dark:hover:text-white transition-all duration-200"
                            onClick={() => onSendMessage(qr.title || qr.payload)}
                            disabled={loading || isAutoPlaying}
                          >
                            {qr.title}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-2 items-center bg-muted rounded-xl px-3.5 py-2 border border-border/50 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Suggested Scenario Steps */}
      {scenarioSteps && scenarioSteps.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/10 border-border">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Scenario Steps (Click to select)</span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {scenarioSteps.map((step, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInput(step.message);
                }}
                className="shrink-0 text-xs text-left bg-background hover:bg-violet-50/50 dark:hover:bg-violet-950/20 border hover:border-violet-500/30 transition-all rounded-lg px-3 py-1.5 max-w-[220px] truncate shadow-sm text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400"
                title={step.message}
                disabled={loading || isAutoPlaying}
              >
                {step.message}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer controls & Input */}
      <CardFooter className="p-4 border-t border-border flex flex-col gap-3 bg-muted/5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClientAiReply}
              disabled={loading || isAutoPlaying}
              className="text-xs h-8 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              AI Client Reply
            </Button>
            <Button
              type="button"
              variant={isAutoPlaying ? "default" : "outline"}
              size="sm"
              onClick={onToggleAutoPlay}
              disabled={loading && !isAutoPlaying}
              className={`text-xs h-8 transition-all ${
                isAutoPlaying 
                  ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm border-transparent" 
                  : "border-border hover:bg-muted text-foreground"
              }`}
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5 mr-1 animate-pulse" />
                  Autoplay On
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Autoplay
                </>
              )}
            </Button>
          </div>
          {isAutoPlaying && (
            <span className="text-[10px] text-violet-500 font-semibold animate-pulse flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              AI is conversing...
            </span>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex w-full gap-2"
        >
          <Input
            placeholder={isAutoPlaying ? "Autoplay is running..." : "Type a message or select a step..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || isAutoPlaying}
            className="flex-1 rounded-lg h-9 border-border bg-background focus-visible:ring-violet-500 text-sm"
          />
          <Button type="submit" size="icon" className="h-9 w-9 bg-violet-600 hover:bg-violet-700 text-white shadow-sm" disabled={loading || !input.trim() || isAutoPlaying}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
