import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageRole } from "@flowmind/shared";

const mocks = vi.hoisted(() => ({
  engineProvider: undefined as { id: string } | undefined,
  engineProviders: [] as { id: string }[],
  runAgentLoop: vi.fn(),
  search: vi.fn(),
  toolRegistryAll: vi.fn(),
  buildLLMConfig: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@flowmind/llm-router", () => ({
  LLMEngine: class {
    getProvider() {
      return mocks.engineProvider;
    }
    getProviders() {
      return mocks.engineProviders;
    }
  },
  runAgentLoop: mocks.runAgentLoop,
  resolveDefaultOllamaModel: vi.fn(),
}));

vi.mock("@flowmind/context-engine", () => ({
  ContextEngine: class {
    search = mocks.search;
  },
}));

vi.mock("@flowmind/tool-system", () => ({
  toolRegistry: { all: mocks.toolRegistryAll },
}));

vi.mock("../lib/config", () => ({ config: { agentRuntimeUrl: "http://agent.test" } }));
vi.mock("../lib/llm-keys", () => ({ buildLLMConfig: mocks.buildLLMConfig }));

vi.mock("../infrastructure", () => ({
  CircuitBreaker: class {
    call = vi.fn();
  },
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  logger: mocks.logger,
}));

import { ChatService } from "../services/ChatService";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.engineProvider = undefined;
  mocks.engineProviders = [];
  mocks.search.mockResolvedValue([]);
  mocks.toolRegistryAll.mockReturnValue([]);
  mocks.buildLLMConfig.mockReturnValue({});
});

describe("ChatService.sendMessageWithAgentLoop", () => {
  it("flags the no-provider canned path as an error (onError, error:true, no fabricated success)", async () => {
    mocks.engineProvider = undefined;
    mocks.engineProviders = [];

    const saveMessage = vi.fn().mockResolvedValue({ id: "assistant-1" });
    const callbacks = { onStep: vi.fn(), onDone: vi.fn(), onError: vi.fn() };

    const result = await new ChatService().sendMessageWithAgentLoop(
      { sessionId: "s1", content: "hello", userId: "u1" },
      saveMessage,
      callbacks,
    );

    expect(result.error).toBe(true);
    expect(result.reply).toContain("No LLM provider");
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(saveMessage).toHaveBeenNthCalledWith(1, MessageRole.USER, "hello");
    expect(saveMessage).toHaveBeenNthCalledWith(
      2,
      MessageRole.ASSISTANT,
      expect.stringContaining("No LLM provider"),
      { error: true },
    );
  });

  it("calls onDone with error:false and saves a success message on a successful run", async () => {
    mocks.engineProvider = { id: "openai" };
    mocks.runAgentLoop.mockResolvedValue({
      response: "Everything is fine",
      steps: [{ type: "tool_call", content: "tool()" }],
      iterations: 2,
    });

    const saveMessage = vi.fn().mockResolvedValue({ id: "assistant-1" });
    const callbacks = { onStep: vi.fn(), onDone: vi.fn(), onError: vi.fn() };

    const result = await new ChatService().sendMessageWithAgentLoop(
      { sessionId: "s1", content: "hello", userId: "u1" },
      saveMessage,
      callbacks,
    );

    expect(result.error).toBe(false);
    expect(result.reply).toBe("Everything is fine");
    expect(callbacks.onDone).toHaveBeenCalledWith(
      expect.objectContaining({ reply: "Everything is fine", error: false }),
    );
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(saveMessage).toHaveBeenNthCalledWith(2, MessageRole.ASSISTANT, "Everything is fine", { error: false });
    expect(mocks.runAgentLoop).toHaveBeenCalledTimes(1);
  });
});