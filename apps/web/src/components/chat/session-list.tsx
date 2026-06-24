"use client";

import { useState } from "react";
import { Plus, MessageSquare, Trash2, Search, X } from "lucide-react";
import { cn, Button } from "@flowmind/ui";
import { useChatStore } from "@/hooks/chat-store";
import type { Session } from "@/hooks/chat-store";

interface SessionListProps {
  onClose: () => void;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function SessionList({ onClose }: SessionListProps) {
  const { sessions, currentSessionId, createSession, deleteSession, selectSession } = useChatStore();
  const [search, setSearch] = useState("");

  const filtered = search
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Chats</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={createSession}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search ? "No conversations found" : "No conversations yet"}
          </div>
        )}
        {filtered.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={session.id === currentSessionId}
            onSelect={() => selectSession(session.id)}
            onDelete={() => deleteSession(session.id)}
          />
        ))}
      </div>

      <div className="border-t border-border px-4 py-2">
        <p className="text-[10px] text-muted-foreground text-center">
          FlowMind Chat
        </p>
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      className={cn(
        "group relative w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-accent/50",
        isActive && "bg-accent"
      )}
    >
      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {session.title}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatDate(session.updatedAt)}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
        aria-label="Delete conversation"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </button>
    </div>
  );
}
