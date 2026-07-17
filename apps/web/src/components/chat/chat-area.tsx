"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Sparkles, Loader2, Terminal } from "lucide-react";
import { Button, ScrollArea } from "@flowmind/ui";
import { useChatStore } from "@/hooks/chat-store";
import { MessageBubble } from "./message-bubble";

const LoadingIndicator = () => (
  <div className="flex-1 flex items-center justify-center bg-background">
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading conversations...</span>
    </div>
  </div>
)

const EmptyState = () => {
  const createSession = useChatStore((s) => s.createSession)
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Welcome to FlowMind Chat
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Start a new conversation or select an existing one from the sidebar.
        </p>
        <Button onClick={createSession}>
          <Sparkles className="mr-2 h-4 w-4" />
          Start New Chat
        </Button>
      </div>
    </div>
  )
}

const NewConversation = () => (
  <div className="flex-1 flex items-center justify-center bg-background">
    <div className="text-center max-w-md px-4">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        New Conversation
      </h2>
      <p className="text-sm text-muted-foreground">
        Send a message to start chatting with FlowMind.
      </p>
    </div>
  </div>
)

function StreamingIndicator({ steps }: { steps: Array<{ type: string; content: string; toolName?: string }> }) {
  if (steps.length === 0) {
    return (
      <div className="flex items-start gap-3 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-center gap-1.5 py-4">
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  const lastStep = steps[steps.length - 1]

  return (
    <div className="flex items-start gap-3 px-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="py-2 space-y-1">
        {lastStep?.type === "tool_call" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3 text-primary" />
            <span>Using <span className="font-medium text-foreground">{lastStep.toolName}</span>...</span>
          </div>
        )}
        {lastStep?.type === "tool_result" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3 text-success" />
            <span>Got result from <span className="font-medium text-foreground">{lastStep.toolName}</span></span>
          </div>
        )}
        {lastStep?.type === "thought" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Thinking...</span>
          </div>
        )}
        {!lastStep && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatArea() {
  const { currentSessionId, messages, isStreaming, loading, streamingSteps } = useChatStore();
  const msgs = currentSessionId ? messages[currentSessionId] || [] : [];

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, msgs[msgs.length - 1]?.content]);

  if (loading) return <LoadingIndicator />;

  if (!currentSessionId) return <EmptyState />;

  if (msgs.length === 0) return <NewConversation />;

  return (
    <div className="flex-1 overflow-hidden bg-background" ref={scrollRef}>
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
          {msgs.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming && <StreamingIndicator steps={streamingSteps} />}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
