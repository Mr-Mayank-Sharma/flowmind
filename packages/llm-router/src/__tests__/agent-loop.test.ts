import { describe, it, expect, vi } from "vitest"
import { runAgentLoop, type AgentTool, type ProviderFacade } from "../agent-loop"
import type { CompletionRequest, CompletionResult } from "../types"

function createMockProvider(responses: CompletionResult[]): ProviderFacade {
  let callIndex = 0
  return {
    id: "mock",
    async complete(_req: CompletionRequest): Promise<CompletionResult> {
      if (callIndex >= responses.length) {
        throw new Error("Mock provider: no more responses configured")
      }
      return responses[callIndex++]!
    },
  }
}

function textResult(content: string, promptTokens = 10, completionTokens = 20): CompletionResult {
  return {
    message: { role: "assistant", content },
    model: "mock-model",
    provider: "mock",
    finish_reason: "stop",
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  }
}

function mockTool(name: string, execFn?: (args: Record<string, unknown>) => Promise<string>): AgentTool {
  return {
    name,
    description: `Mock ${name} tool`,
    parameters: { input: { type: "string" } },
    execute: execFn ?? (async (args) => `Result for ${name}: ${JSON.stringify(args)}`),
  }
}

describe("runAgentLoop", () => {
  it("returns FINAL_ANSWER directly without tool calls", async () => {
    const provider = createMockProvider([textResult("FINAL_ANSWER: Hello, world!")])
    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "You are helpful.",
      userMessage: "Say hello",
      tools: [],
    })

    expect(result.response).toBe("Hello, world!")
    expect(result.iterations).toBe(1)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]!.type).toBe("thought")
    expect(result.usage.promptTokens).toBe(10)
    expect(result.usage.completionTokens).toBe(20)
    expect(result.usage.totalTokens).toBe(30)
  })

  it("calls a tool then returns FINAL_ANSWER", async () => {
    const readTool = mockTool("read", async () => "file contents here")
    const provider = createMockProvider([
      textResult('CALL_TOOL: read({"path": "./test.txt"})'),
      textResult("FINAL_ANSWER: The file contains: file contents here"),
    ])

    const onStep = vi.fn()
    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "read ./test.txt and summarize",
      tools: [readTool],
      onStep,
    })

    expect(result.response).toBe("The file contains: file contents here")
    expect(result.iterations).toBe(2)
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0]!.type).toBe("thought")
    expect(result.steps[1]!.type).toBe("tool_call")
    expect(result.steps[1]!.toolName).toBe("read")
    expect(result.steps[2]!.type).toBe("tool_result")
    expect(result.steps[2]!.content).toBe("file contents here")
    expect(result.steps[3]!.type).toBe("thought")
    expect(onStep).toHaveBeenCalledTimes(4)
  })

  it("handles tool execution errors gracefully", async () => {
    const failingTool = mockTool("fail_tool", async () => { throw new Error("boom") })
    const provider = createMockProvider([
      textResult('CALL_TOOL: fail_tool({"x": 1})'),
      textResult("FINAL_ANSWER: The tool failed but I handled it."),
    ])

    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "try something",
      tools: [failingTool],
    })

    expect(result.response).toBe("The tool failed but I handled it.")
    expect(result.steps[2]!.content).toContain("[Tool fail_tool error: boom]")
  })

  it("returns error when LLM call throws", async () => {
    const provider: ProviderFacade = {
      id: "mock",
      complete: async () => { throw new Error("LLM is down") },
    }

    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "hello",
      tools: [],
    })

    expect(result.response).toContain("[LLM error: LLM is down]")
    expect(result.steps[0]!.type).toBe("error")
  })

  it("stops at maxIterations", async () => {
    const provider = createMockProvider([
      textResult('CALL_TOOL: read({"path": "a"})'),
      textResult('CALL_TOOL: read({"path": "b"})'),
      textResult('CALL_TOOL: read({"path": "c"})'),
    ])

    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "loop forever",
      tools: [mockTool("read")],
      maxIterations: 3,
    })

    expect(result.response).toContain("Max iterations")
    expect(result.iterations).toBe(3)
  })

  it("aborts when signal is triggered", async () => {
    const controller = new AbortController()
    const provider = createMockProvider([
      textResult('CALL_TOOL: read({"path": "a"})'),
      textResult('CALL_TOOL: read({"path": "b"})'),
    ])

    const tool = mockTool("read", async () => {
      controller.abort()
      return "done"
    })

    await expect(runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "loop",
      tools: [tool],
      maxIterations: 10,
      signal: controller.signal,
    })).rejects.toThrow("Agent loop aborted")
  })

  it("reports unknown tool calls", async () => {
    const provider = createMockProvider([
      textResult('CALL_TOOL: nonexistent({"x": 1})'),
      textResult("FINAL_ANSWER: tool wasn't available"),
    ])

    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "do something",
      tools: [mockTool("read")],
    })

    expect(result.steps[2]!.content).toContain('Tool "nonexistent" not found')
    expect(result.steps[2]!.content).toContain("Available: read")
  })

  it("handles malformed JSON in tool args", async () => {
    const readTool = mockTool("read")
    const provider = createMockProvider([
      textResult("CALL_TOOL: read(not json at all)"),
      textResult("FINAL_ANSWER: done"),
    ])

    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "read this",
      tools: [readTool],
    })

    expect(result.steps[1]!.toolArgs).toEqual({ input: "not json at all" })
    expect(result.response).toBe("done")
  })

  it("handles empty provider content as empty response", async () => {
    const provider = createMockProvider([textResult("")])

    const result = await runAgentLoop({
      provider,
      model: "mock-model",
      systemPrompt: "",
      userMessage: "hi",
      tools: [],
    })

    expect(result.response).toBe("")
    expect(result.iterations).toBe(1)
  })
})
