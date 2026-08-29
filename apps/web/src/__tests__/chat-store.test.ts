import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  api: {
    chat: {
      sendMessage: vi.fn(),
      getSessions: vi.fn(),
      getSession: vi.fn(),
      createSession: vi.fn(),
      deleteSession: vi.fn(),
    },
  },
  getToken: vi.fn(),
  API_URL: "http://api.test",
}));

vi.mock("@/lib/api", () => mocks);

import { useChatStore } from "@/hooks/chat-store";

function resetStore() {
  useChatStore.setState({
    sessions: [],
    currentSessionId: null,
    messages: {},
    isStreaming: false,
    initialized: false,
    loading: true,
    streamingSteps: [],
  });
}

function sseResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  mocks.getToken.mockReturnValue(null);
  mocks.api.chat.sendMessage.mockResolvedValue({ message: { id: "msg-1" }, streamUrl: "http://api.test/s" });
  useChatStore.setState({
    sessions: [{ id: "s1", title: "New Chat", createdAt: 0, updatedAt: 0 }],
    currentSessionId: "s1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChatStore.sendMessage SSE handling", () => {
  it("marks the assistant message as an error when the stream emits an error event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse('data: {"type":"error","message":"Provider exploded"}\n\n')));

    await useChatStore.getState().sendMessage("hello");

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.messages.s1?.[1]).toMatchObject({ role: "assistant", content: "Provider exploded", error: true });
  });

  it("records a successful done event without an error flag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse('data: {"type":"done","reply":"All good","error":false}\n\n')));

    await useChatStore.getState().sendMessage("hello");

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.messages.s1?.[1]).toMatchObject({ role: "assistant", content: "All good" });
    expect(state.messages.s1?.[1]?.error).toBeFalsy();
  });

  it("requires a current session before sending", async () => {
    useChatStore.setState({ currentSessionId: null });

    await useChatStore.getState().sendMessage("hello");

    expect(mocks.api.chat.sendMessage).not.toHaveBeenCalled();
  });
});