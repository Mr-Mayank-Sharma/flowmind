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
const MAX_STREAM_DURATION = 90_000

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
  const createdAt = new Date(apiSession.createdAt || apiSession.created_at)
  const updatedAt = new Date(apiSession.updatedAt || apiSession.updated_at)
  return {
    id: apiSession.id,
    title: apiSession.title || "New Chat",
    createdAt: isNaN(createdAt.getTime()) ? Date.now() : createdAt.getTime(),
    updatedAt: isNaN(updatedAt.getTime()) ? Date.now() : updatedAt.getTime(),
  }
}

function apiMessageToLocal(apiMsg: any, sessionId: string): Message {
  const ts = new Date(apiMsg.createdAt || apiMsg.created_at)
  return {
    id: apiMsg.id,
    sessionId,
    role: apiMsg.role as Role,
    content: apiMsg.content,
    timestamp: isNaN(ts.getTime()) ? Date.now() : ts.getTime(),
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

function parseSSEChunk(chunk: string, onData: (data: string) => void) {
  const lines = chunk.split(/\r?\n/)
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      onData(line.slice(6))
    } else if (line.startsWith("data:")) {
      onData(line.slice(5))
    }
  }
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

        const firstId = apiSessions[0]?.id ?? null
        set({
          sessions: apiSessions,
          currentSessionId: firstId,
          messages: mergedMessages,
          loading: false,
        })
        if (firstId) {
          get().loadMessages(firstId)
        }
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
    if (messages[sessionId]?.length) return

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
    const { currentSessionId } = get()
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

    const abortController = new AbortController()
    ;(get() as any)._abortController = abortController

    let accumulatedContent = ""
    let finalContent: string | null = null
    const toolCalls: ToolCall[] = []
    let toolCallId = 0
    let finished = false

    let streamTimer: ReturnType<typeof setTimeout> | undefined

    const finalize = (contentOverride?: string) => {
      if (finished) return
      finished = true
      const content = contentOverride ?? ((finalContent ?? accumulatedContent) || "I processed your request.")
      set((s) => {
        const msgs = s.messages[currentSessionId] || []
        const updatedMsgs = msgs.map((m) =>
          m.id === assistantId
            ? { ...m, content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined }
            : m
        )
        const next = {
          isStreaming: false,
          streamingSteps: [],
          messages: { ...s.messages, [currentSessionId]: updatedMsgs },
        }
        saveToStorage(s.sessions, next.messages)
        return next
      })
    }

    const handleSseData = (data: string) => {
      if (data === "[DONE]") {
        finalize()
        return
      }

      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch {
        return
      }

      if (parsed.type === "error") {
        finalize(parsed.message || "An error occurred.")
        return
      }

      if (parsed.type === "done") {
        finalContent = parsed.reply || accumulatedContent
        finalize()
        return
      }

      if (parsed.type === "thought") {
        accumulatedContent = parsed.content
        set((s) => {
          const msgs = s.messages[currentSessionId!] || []
          const updatedMsgs = msgs.map((m) =>
            m.id === assistantId ? { ...m, content: accumulatedContent } : m
          )
          return { messages: { ...s.messages, [currentSessionId!]: updatedMsgs } }
        })
        return
      }

      if (parsed.type === "tool_call") {
        toolCallId++
        toolCalls.push({
          id: `tc_${toolCallId}`,
          name: parsed.toolName || "unknown",
          arguments: parsed.content || "",
        })
        set((s) => {
          const msgs = s.messages[currentSessionId!] || []
          const updatedMsgs = msgs.map((m) =>
            m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m
          )
          return {
            streamingSteps: [...s.streamingSteps, { type: "tool_call", content: parsed.content, toolName: parsed.toolName }],
            messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
          }
        })
        return
      }

      if (parsed.type === "tool_result") {
        const lastTc = toolCalls[toolCalls.length - 1]
        if (lastTc) lastTc.result = parsed.content
        set((s) => {
          const msgs = s.messages[currentSessionId!] || []
          const updatedMsgs = msgs.map((m) =>
            m.id === assistantId ? { ...m, toolCalls: [...toolCalls] } : m
          )
          return {
            streamingSteps: [...s.streamingSteps, { type: "tool_result", content: parsed.content }],
            messages: { ...s.messages, [currentSessionId!]: updatedMsgs },
          }
        })
        return
      }
    }

    try {
      const token = getToken()
      const streamUrl = `${API_URL}/api/chat/stream/${currentSessionId}`

      let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null

      const openStream = async () => {
        try {
          const res = await fetch(streamUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: abortController.signal,
          })
          if (!res.ok || !res.body) throw new Error(`Stream failed (HTTP ${res.status})`)
          streamReader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ""
          while (true) {
            const { done, value } = await streamReader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const newlineIdx = buffer.lastIndexOf("\n\n")
            if (newlineIdx >= 0) {
              const chunk = buffer.slice(0, newlineIdx)
              buffer = buffer.slice(newlineIdx + 2)
              parseSSEChunk(chunk, (d) => handleSseData(d))
            }
          }
          if (buffer.trim()) {
            parseSSEChunk(buffer, (d) => handleSseData(d))
          }
        } catch (err) {
          if ((err as any)?.name === "AbortError") return
          if (!finished) {
            finalize("Connection lost. Please try again.")
          }
        }
      }

      const streamPromise = openStream()

      streamTimer = setTimeout(() => {
        abortController.abort()
        finalize("The response is taking too long. Please try again.")
      }, MAX_STREAM_DURATION)

      const mutationPromise = api.chat.sendMessage({
        sessionId: currentSessionId,
        content,
        model: model || undefined,
        files: files?.map(f => ({ url: f.name, type: f.type })) || undefined,
      })

      const [mutationResult] = await Promise.allSettled([mutationPromise, streamPromise])

      if (mutationResult.status === "rejected") {
        const err = mutationResult.reason
        const isUnauthorized = (err as any)?.code === "UNAUTHORIZED"
        finalize(isUnauthorized ? "Your session expired. Please sign in again." : "I encountered an error processing your request. Please try again.")
      } else if (!finished) {
        finalize()
      }
    } catch (err) {
      finalize("I encountered an error processing your request. Please try again.")
    } finally {
      if (streamTimer) clearTimeout(streamTimer)
      ;(get() as any)._abortController = null
    }
  },

  stopStreaming: () => {
    const ac = (get() as any)._abortController as AbortController | null
    if (ac) ac.abort()
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
