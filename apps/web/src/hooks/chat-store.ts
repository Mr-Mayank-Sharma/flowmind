import { create } from "zustand";
import { api, getToken, API_URL } from "@/lib/api";

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

function apiSessionToLocal(apiSession: any): Session {
  return {
    id: apiSession.id,
    title: apiSession.title || "New Chat",
    createdAt: new Date(apiSession.createdAt || apiSession.created_at).getTime(),
    updatedAt: new Date(apiSession.updatedAt || apiSession.updated_at).getTime(),
  }
}

function apiMessageToLocal(apiMsg: any, sessionId: string): Message {
  return {
    id: apiMsg.id,
    sessionId,
    role: apiMsg.role as Role,
    content: apiMsg.content,
    timestamp: new Date(apiMsg.createdAt || apiMsg.created_at || Date.now()).getTime(),
  }
}

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  initialized: boolean;
  loading: boolean;
  streamingSteps: Array<{ type: string; content: string; toolName?: string }>;
  init: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  selectSession: (id: string) => void;
  sendMessage: (content: string, model?: string, files?: { name: string; type: string; size: number }[]) => Promise<void>;
  stopStreaming: () => void;
  appendToMessage: (sessionId: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
}

const persisted = loadFromStorage()

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  isStreaming: false,
  initialized: false,
  loading: true,
  streamingSteps: [],
  _eventSource: null as EventSource | null,

  init: async () => {
    if (get().initialized) return
    set({ initialized: true, loading: true })

    try {
      const result = await api.chat.getSessions({ limit: 50 })
      if (result?.sessions?.length > 0) {
        const apiSessions = result.sessions.map(apiSessionToLocal)
        const cached = loadFromStorage()
        const mergedMessages: Record<string, Message[]> = cached?.messages ? { ...cached.messages } : {}

        set({
          sessions: apiSessions,
          currentSessionId: apiSessions[0]?.id ?? null,
          messages: mergedMessages,
          loading: false,
        })
        return
      }
    } catch {}

    if (persisted) {
      set({
        sessions: persisted.sessions,
        currentSessionId: persisted.sessions?.[0]?.id ?? null,
        messages: persisted.messages,
        loading: false,
      })
      return
    }

    set({ loading: false })
  },

  loadMessages: async (sessionId) => {
    const { messages } = get()
    if (messages[sessionId]) return

    try {
      const result = await api.chat.getSession(sessionId)
      if (result?.messages) {
        const msgs = result.messages.map((m: any) => apiMessageToLocal(m, sessionId))
        set((state) => ({
          messages: { ...state.messages, [sessionId]: msgs },
        }))
      }
    } catch {}
  },

  createSession: async () => {
    try {
      const result = await api.chat.createSession({ title: "New Chat" })
      if (!result?.id) {
        throw new Error("No session ID returned")
      }

      const session: Session = {
        id: result.id,
        title: result.title || "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      set((state) => {
        const next = {
          sessions: [session, ...state.sessions],
          currentSessionId: session.id,
          messages: { ...state.messages, [session.id]: [] },
        }
        saveToStorage(next.sessions, next.messages)
        return next
      })
    } catch (err) {
      console.error("Failed to create session:", err)
    }
  },

  deleteSession: async (id) => {
    try {
      await api.chat.deleteSession(id)
    } catch {}

    set((state) => {
      const { [id]: _, ...rest } = state.messages
      const filtered = state.sessions.filter((s) => s.id !== id)
      const next = {
        sessions: filtered,
        messages: rest,
        currentSessionId:
          state.currentSessionId === id
            ? filtered[0]?.id ?? null
            : state.currentSessionId,
      }
      saveToStorage(next.sessions, next.messages)
      return next
    })
  },

  selectSession: (id) => {
    set({ currentSessionId: id })
    get().loadMessages(id)
  },

  sendMessage: async (content, model?, files?) => {
    const state = get()
    const { currentSessionId } = state
    if (!currentSessionId) return

    const userMessage: Message = {
      id: String(Date.now()),
      sessionId: currentSessionId,
      role: "user",
      content,
      timestamp: Date.now(),
    }

    const assistantId = String(Date.now() + 1)

    set((s) => {
      const msgs = s.messages[currentSessionId] || []
      const next = {
        isStreaming: true,
        streamingSteps: [] as Array<{ type: string; content: string; toolName?: string }>,
        messages: {
          ...s.messages,
          [currentSessionId]: [...msgs, userMessage, {
            id: assistantId,
            sessionId: currentSessionId,
            role: "assistant" as Role,
            content: "",
            timestamp: Date.now(),
          }],
        },
        sessions: s.sessions.map((sess) =>
          sess.id === currentSessionId
            ? { ...sess, updatedAt: Date.now(), title: sess.title === "New Chat" ? content.slice(0, 40) : sess.title }
            : sess
        ),
      }
      saveToStorage(next.sessions, next.messages)
      return next
    })

    try {
      const token = getToken()
      const eventSourceUrl = `${API_URL}/api/chat/stream/${currentSessionId}${token ? `?token=${encodeURIComponent(token)}` : ""}`

      const eventSource = new EventSource(eventSourceUrl)
      ;(get() as any)._eventSource = eventSource

      let accumulatedContent = ""
      const toolCalls: ToolCall[] = []
      let toolCallId = 0

      eventSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          eventSource.close()
          ;(get() as any)._eventSource = null

          set((s) => {
            const msgs = s.messages[currentSessionId!] || []
            const updatedMsgs = msgs.map((m) =>
              m.id === assistantId
                ? { ...m, content: accumulatedContent || "I processed your request.", toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
                : m
            )
            const next = {
              isStreaming: false,
              streamingSteps: [],
              messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
            }
            saveToStorage(state.sessions, next.messages)
            return next
          })
          return
        }

        try {
          const data = JSON.parse(event.data)

          if (data.type === "error") {
            set((s) => {
              const msgs = s.messages[currentSessionId!] || []
              const updatedMsgs = msgs.map((m) =>
                m.id === assistantId
                  ? { ...m, content: data.message || "An error occurred." }
                  : m
              )
              return {
                isStreaming: false,
                streamingSteps: [],
                messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
              }
            })
            eventSource.close()
            return
          }

          if (data.type === "done") {
            eventSource.close()
            ;(get() as any)._eventSource = null

            const finalContent = data.reply || accumulatedContent
            set((s) => {
              const msgs = s.messages[currentSessionId!] || []
              const updatedMsgs = msgs.map((m) =>
                m.id === assistantId
                  ? { ...m, content: finalContent || "I processed your request.", toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
                  : m
              )
              const next = {
                isStreaming: false,
                streamingSteps: [],
                messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
              }
              saveToStorage(state.sessions, next.messages)
              return next
            })
            return
          }

          if (data.type === "thought") {
            accumulatedContent = data.content
            set((s) => {
              const msgs = s.messages[currentSessionId!] || []
              const updatedMsgs = msgs.map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedContent } : m
              )
              return { messages: { ...s.messages, [currentSessionId!]: updatedMsgs } }
            })
          }

          if (data.type === "tool_call") {
            toolCallId++
            toolCalls.push({
              id: `tc_${toolCallId}`,
              name: data.toolName || "unknown",
              arguments: data.content || "",
            })
            set((s) => {
              const msgs = s.messages[currentSessionId!] || []
              const updatedMsgs = msgs.map((m) =>
                m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m
              )
              return {
                streamingSteps: [...s.streamingSteps, { type: "tool_call", content: data.content, toolName: data.toolName }],
                messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
              }
            })
          }

          if (data.type === "tool_result") {
            const lastTc = toolCalls[toolCalls.length - 1]
            if (lastTc) lastTc.result = data.content
            set((s) => {
              const msgs = s.messages[currentSessionId!] || []
              const updatedMsgs = msgs.map((m) =>
                m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m
              )
              return {
                streamingSteps: [...s.streamingSteps, { type: "tool_result", content: data.content }],
                messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
              }
            })
          }
        } catch {}
      }

      eventSource.onerror = () => {
        eventSource.close()
        ;(get() as any)._eventSource = null

        if (!accumulatedContent) {
          set((s) => {
            const msgs = s.messages[currentSessionId!] || []
            const updatedMsgs = msgs.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Connection lost. Please try again." }
                : m
            )
            return {
              isStreaming: false,
              streamingSteps: [],
              messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
            }
          })
        } else {
          set((s) => {
            const msgs = s.messages[currentSessionId!] || []
            const updatedMsgs = msgs.map((m) =>
              m.id === assistantId ? { ...m, content: accumulatedContent } : m
            )
            return {
              isStreaming: false,
              streamingSteps: [],
              messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
            }
          })
        }
      }

      await api.chat.sendMessage({
        sessionId: currentSessionId,
        content,
        model: model || undefined,
        files: files?.map(f => ({ url: f.name, type: f.type })) || undefined,
      })
    } catch (err) {
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        sessionId: currentSessionId,
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: Date.now(),
      }
      set((s) => {
        const msgs = s.messages[currentSessionId] || []
        const next = {
          isStreaming: false,
          streamingSteps: [],
          messages: {
            ...s.messages,
            [currentSessionId]: [...msgs, errorMsg],
          },
        }
        saveToStorage(state.sessions, next.messages)
        return next
      })
    }
  },

  stopStreaming: () => {
    const es = (get() as any)._eventSource as EventSource | null
    if (es) {
      es.close()
      ;(get() as any)._eventSource = null
    }
    set({ isStreaming: false, streamingSteps: [] })
  },

  appendToMessage: (sessionId, content) => {
    set((state) => {
      const msgs = state.messages[sessionId] || []
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === "assistant") {
        const next = {
          messages: {
            ...state.messages,
            [sessionId]: msgs.map((m, i) =>
              i === msgs.length - 1 ? { ...m, content: m.content + content } : m
            ),
          },
        }
        saveToStorage(state.sessions, next.messages)
        return next
      }
      return state
    })
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming })
  },
}))
