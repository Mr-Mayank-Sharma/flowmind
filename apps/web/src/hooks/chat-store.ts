import { create } from "zustand";

export type Role = "user" | "assistant" | "system" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "flowmind_chat_data"

interface PersistedData {
  sessions: Session[]
  messages: Record<string, Message[]>
}

function loadFromStorage(): PersistedData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveToStorage(sessions: Session[], messages: Record<string, Message[]>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, messages }))
  } catch {}
}

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  createSession: () => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  appendToMessage: (sessionId: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
}

const persisted = loadFromStorage()

function getDefaultSessions(): Session[] {
  return [{
    id: "1",
    title: "Getting Started with FlowMind",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
  }]
}

function getDefaultMessages(): Record<string, Message[]> {
  return {
    "1": [{
      id: "101",
      sessionId: "1",
      role: "assistant",
      content: "Hello! I'm the FlowMind AI agent. I can help you:\n\n- **Read files**: Try `read path/to/file`\n- **Run commands**: Try `run ls -la`\n- **Search code**: Try `search for something in src/`\n- **List directories**: Try `list files in .`\n\nWhat would you like me to do?",
      timestamp: Date.now() - 3600000,
    }],
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: persisted?.sessions ?? getDefaultSessions(),
  currentSessionId: persisted?.sessions?.[0]?.id ?? "1",
  messages: persisted?.messages ?? getDefaultMessages(),
  isStreaming: false,

  createSession: () => {
    const id = String(Date.now());
    const session: Session = {
      id,
      title: "New Chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => {
      const next = {
        sessions: [session, ...state.sessions],
        currentSessionId: id,
        messages: { ...state.messages, [id]: [] },
      };
      saveToStorage(next.sessions, next.messages)
      return next;
    });
  },

  deleteSession: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.messages;
      const filtered = state.sessions.filter((s) => s.id !== id);
      const next = {
        sessions: filtered,
        messages: rest,
        currentSessionId:
          state.currentSessionId === id
            ? filtered[0]?.id ?? null
            : state.currentSessionId,
      };
      saveToStorage(next.sessions, next.messages)
      return next;
    });
  },

  selectSession: (id) => {
    set({ currentSessionId: id });
  },

  sendMessage: async (content) => {
    const { currentSessionId, messages } = get();
    if (!currentSessionId) return;

    const userMessage: Message = {
      id: String(Date.now()),
      sessionId: currentSessionId,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    set((state) => {
      const msgs = state.messages[currentSessionId] || [];
      const next = {
        isStreaming: true,
        messages: {
          ...state.messages,
          [currentSessionId]: [...msgs, userMessage],
        },
        sessions: state.sessions.map((s) =>
          s.id === currentSessionId
            ? { ...s, updatedAt: Date.now(), title: s.title === "New Chat" ? content.slice(0, 40) : s.title }
            : s
        ),
      };
      saveToStorage(next.sessions, next.messages)
      return next;
    });

    try {
      const history = messages[currentSessionId] || []
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: history.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: String(Date.now() + 1),
        sessionId: currentSessionId,
        role: "assistant",
        content: data.content || "I processed your request.",
        timestamp: Date.now(),
        toolCalls: data.toolCalls || [],
      }

      set((state) => {
        const msgs = state.messages[currentSessionId] || [];
        const next = {
          isStreaming: false,
          messages: {
            ...state.messages,
            [currentSessionId]: [...msgs, assistantMessage],
          },
        };
        saveToStorage(state.sessions, next.messages)
        return next;
      })
    } catch (err) {
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        sessionId: currentSessionId,
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: Date.now(),
      }

      set((state) => {
        const msgs = state.messages[currentSessionId] || [];
        const next = {
          isStreaming: false,
          messages: {
            ...state.messages,
            [currentSessionId]: [...msgs, errorMessage],
          },
        };
        saveToStorage(state.sessions, next.messages)
        return next;
      })
    }
  },

  appendToMessage: (sessionId, content) => {
    set((state) => {
      const msgs = state.messages[sessionId] || [];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        const next = {
          messages: {
            ...state.messages,
            [sessionId]: msgs.map((m, i) =>
              i === msgs.length - 1 ? { ...m, content: m.content + content } : m
            ),
          },
        };
        saveToStorage(state.sessions, next.messages)
        return next;
      }
      return state;
    });
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming });
  },
}));
