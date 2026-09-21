import { describe, it, expect, vi } from "vitest"
import { LLMEngine } from "../engine"
import type { ProviderFacade, CompletionRequest, CompletionResult, CompletionChunk, StreamCallbacks } from "../types"

function makeProvider(id: string): ProviderFacade {
  return {
    id,
    baseUrl: `mock://${id}`,
    async complete(_req: CompletionRequest): Promise<CompletionResult> {
      return {
        message: { role: "assistant", content: "ok" },
        finish_reason: "stop",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        model: "mock",
        provider: id,
      }
    },
    async stream(_req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
      callbacks.onChunk?.({ delta: { content: "a" }, model: "mock", provider: id })
      callbacks.onChunk?.({ delta: { content: "b" }, model: "mock", provider: id })
      const result: CompletionResult = {
        message: { role: "assistant", content: "ab" },
        finish_reason: "stop",
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        model: "mock",
        provider: id,
      }
      callbacks.onDone?.(result)
      return result
    },
  }
}

describe("LLMEngine.streamAsync", () => {
  it("calls provider.stream exactly once and yields every chunk", async () => {
    const provider = makeProvider("openai")
    const streamSpy = vi.spyOn(provider, "stream")
    const engine = new LLMEngine({})
    engine.register("openai", provider)

    const chunks: CompletionChunk[] = []
    let result: CompletionResult | undefined
    for await (const chunk of engine.streamAsync({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] })) {
      chunks.push(chunk)
    }

    expect(streamSpy).toHaveBeenCalledTimes(1)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]!.delta.content).toBe("a")
    expect(chunks[1]!.delta.content).toBe("b")
  })

  it("propagates onError from the provider", async () => {
    const provider: ProviderFacade = {
      ...makeProvider("openai"),
      async stream(_req: CompletionRequest, callbacks: StreamCallbacks): Promise<CompletionResult> {
        callbacks.onError?.(new Error("stream exploded"))
        throw new Error("stream exploded")
      },
    }
    const engine = new LLMEngine({})
    engine.register("openai", provider)

    await expect(async () => {
      for await (const _chunk of engine.streamAsync({ model: "gpt-4o", messages: [] })) {
        // no-op
      }
    }).rejects.toThrow("stream exploded")
  })

  it("surfaces HTTP-style failures that never reach the callbacks", async () => {
    const provider: ProviderFacade = {
      ...makeProvider("openai"),
      async stream(): Promise<CompletionResult> {
        throw new Error("upstream 502")
      },
    }
    const engine = new LLMEngine({})
    engine.register("openai", provider)

    await expect(async () => {
      for await (const _chunk of engine.streamAsync({ model: "gpt-4o", messages: [] })) {
        // no-op
      }
    }).rejects.toThrow("upstream 502")
  })
})

describe("LLMEngine.resolveProvider", () => {
  it("routes gpt-* models to openai", () => {
    const engine = new LLMEngine({})
    engine.register("openai", makeProvider("openai"))
    engine.register("ollama", makeProvider("ollama"))

    const result = engine.complete({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] })
    return result.then((r) => expect(r.provider).toBe("openai"))
  })

  it("routes claude-* models to anthropic", () => {
    const engine = new LLMEngine({})
    engine.register("openai", makeProvider("openai"))
    engine.register("anthropic", makeProvider("anthropic"))

    const result = engine.complete({ model: "claude-3-5-sonnet", messages: [{ role: "user", content: "hi" }] })
    return result.then((r) => expect(r.provider).toBe("anthropic"))
  })

  it("routes llama/qwen/mistral models to ollama", () => {
    const engine = new LLMEngine({})
    engine.register("openai", makeProvider("openai"))
    engine.register("ollama", makeProvider("ollama"))

    const result = engine.complete({ model: "llama3.2", messages: [{ role: "user", content: "hi" }] })
    return result.then((r) => expect(r.provider).toBe("ollama"))
  })

  it("falls back to the first provider for unknown model names", () => {
    const engine = new LLMEngine({})
    engine.register("openai", makeProvider("openai"))
    engine.register("ollama", makeProvider("ollama"))

    const result = engine.complete({ model: "mystery-model", messages: [{ role: "user", content: "hi" }] })
    return result.then((r) => expect(r.provider).toBe("openai"))
  })

  it("prefers an explicit provider over model-based routing", () => {
    const engine = new LLMEngine({})
    engine.register("openai", makeProvider("openai"))
    engine.register("ollama", makeProvider("ollama"))

    const result = engine.complete({ provider: "ollama", model: "gpt-4o", messages: [{ role: "user", content: "hi" }] })
    return result.then((r) => expect(r.provider).toBe("ollama"))
  })

  it("throws a clear error when no providers are configured", () => {
    const engine = new LLMEngine({})
    expect(() => engine.complete({ model: "gpt-4o", messages: [] })).rejects.toThrow("No LLM providers configured")
  })
})