"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PanelLeft, MessageSquare } from "lucide-react";
import { cn, Button } from "@flowmind/ui";
import { useChatStore } from "@/hooks/chat-store";
import { SessionList } from "./session-list";
import { ChatArea } from "./chat-area";
import { ChatInput } from "./chat-input";

export function ChatLayout() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { currentSessionId, selectSession, init, sessions, loading } = useChatStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    init()
  }, [init])

  const firstSessionId = sessions[0]?.id;

  useEffect(() => {
    if (firstSessionId && !currentSessionId) {
      selectSession(firstSessionId)
    }
  }, [firstSessionId, currentSessionId, selectSession])

  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      selectSession(sessionId);
    }
  }, [sessionId, currentSessionId, selectSession]);

  return (
    <div className="flex h-[calc(100vh-0px)] bg-background">
      <aside
        className={cn(
          "flex-shrink-0 border-r border-border bg-surface transition-all duration-300 overflow-hidden",
          sidebarOpen ? "w-[320px]" : "w-0"
        )}
      >
        <SessionList onClose={() => setSidebarOpen(false)} />
      </aside>

      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-2 border-b border-border px-4 h-14 bg-surface">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
          {!currentSessionId && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">No conversation selected</span>
            </div>
          )}
        </header>

        <ChatArea />
        <ChatInput />
      </main>
    </div>
  );
}
