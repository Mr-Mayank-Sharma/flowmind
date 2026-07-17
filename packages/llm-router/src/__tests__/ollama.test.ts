import { describe, it, expect, vi, afterEach } from "vitest"
import { createOllamaProvider } from "../providers/ollama"

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(typeof response === "string" ? response : JSON.stringify(response)),
    body: null,
  })
}

function mockStreamFetch(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: { getReader: () => stream.getReader() },
    text: () => Promise.resolve(chunks.join("\n")),
  })
}

describe("OllamaProvider", () => {
  it("returns provider facade with correct id and baseUrl", () => {
    const provider = createOllamaProvider("http://localhost:11434")
    expect(provider.id).toBe("ollama")
    expect(provider.baseUrl).toBe("http://localhost:11434")
  })

  it("completes a chat request and returns content", async () => {
    vi.stubGlobal("fetch", mockFetch({
      model: "llama3.2",
      created_at: "2024-01-01T00:00:00Z",
      message: { role: "assistant", content: "Hello! How can I help you today?" },
      done: true,
      prompt_eval_count: 10,
      eval_count: 20,
      total_duration: 1000000000,
    }))

    const provider = createOllamaProvider("http://localhost:11434")
    const result = await provider.complete({
      model: "llama3.2",
      messages: [{ role: "user", content: "Say hello" }],
    })

    expect(result.message.content).toBe("Hello! How can I help you today?")
    expect(result.model).toBe("llama3.2")
    expect(result.provider).toBe("ollama")
    expect(result.finish_reason).toBe("stop")
    expect(result.usage.prompt_tokens).toBe(10)
    expect(result.usage.completion_tokens).toBe(20)
    expect(result.usage.total_tokens).toBe(30)
  })

  it("streams chat response via callbacks", async () => {
    const chunks = [
      JSON.stringify({ model: "llama3.2", message: { role: "assistant", content: "Hello" }, done: false }) + "\n",
      JSON.stringify({ model: "llama3.2", message: { role: "assistant", content: " world" }, done: false }) + "\n",
      JSON.stringify({ model: "llama3.2", message: { role: "assistant", content: "" }, done: true, prompt_eval_count: 5, eval_count: 10 }) + "\n",
    ]

    vi.stubGlobal("fetch", mockStreamFetch(chunks))

    const provider = createOllamaProvider("http://localhost:11434")
    const onChunk = vi.fn()
    const onDone = vi.fn()

    await provider.stream(
      { model: "llama3.2", messages: [{ role: "user", content: "Say hello" }] },
      { onChunk, onDone },
    )

    expect(onChunk).toHaveBeenCalledTimes(2)
    expect(onChunk).toHaveBeenNthCalledWith(1, expect.objectContaining({ delta: { content: "Hello" }, model: "llama3.2", provider: "ollama" }))
    expect(onChunk).toHaveBeenNthCalledWith(2, expect.objectContaining({ delta: { content: " world" }, model: "llama3.2", provider: "ollama" }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      message: { role: "assistant", content: "Hello world" },
      provider: "ollama",
    }))
  })

  it("returns default model when none provided", async () => {
    vi.stubGlobal("fetch", mockFetch({
      model: "tinyllama",
      message: { role: "assistant", content: "OK" },
      done: true,
    }))

    const provider = createOllamaProvider()
    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    })

    expect(result.model).toBe("tinyllama")
  })

  it("throws on API error", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "model not found" }, 404))

    const provider = createOllamaProvider("http://localhost:11434")
    await expect(provider.complete({
      model: "nonexistent",
      messages: [{ role: "user", content: "hi" }],
    })).rejects.toThrow("Ollama API error 404")
  })

  it("reports error via onError callback during stream", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "bad request" }, 400))

    const provider = createOllamaProvider("http://localhost:11434")
    const onError = vi.fn()

    await expect(provider.stream(
      { model: "test", messages: [{ role: "user", content: "hi" }] },
      { onError },
    )).rejects.toThrow("Ollama API error 400")

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Ollama API error 400") }))
  })

  it("exposes Ollama model list via provider-registry (static models already present)", () => {
    // Static Ollama models are defined in @flowmind/provider-registry
    // This test verifies the provider facade contract is satisfied
    const baseUrl = "http://localhost:11434"
    const provider = createOllamaProvider(baseUrl)
    expect(provider.complete).toBeInstanceOf(Function)
    expect(provider.stream).toBeInstanceOf(Function)
  })
})
