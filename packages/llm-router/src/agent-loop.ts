import type { CompletionRequest, CompletionResult, ProviderFacade, ContentBlock } from "./types"

function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<string>
}

export interface AgentLoopStep {
  type: "thought" | "tool_call" | "tool_result" | "error"
  content: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

export interface AgentLoopOptions {
  provider: ProviderFacade
  model: string
  systemPrompt: string
  userMessage: string
  tools: AgentTool[]
  maxIterations?: number
  maxTokens?: number
  onStep?: (step: AgentLoopStep) => void
  signal?: AbortSignal
}

export interface AgentLoopResult {
  response: string
  iterations: number
  steps: AgentLoopStep[]
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

const TOOL_USE_PATTERN = /^CALL_TOOL:\s*(\w+)\s*\(([\s\S]*)\)\s*$/m
const FINAL_ANSWER_PATTERN = /^FINAL_ANSWER:\s*([\s\S]*)$/m

function buildToolList(tools: AgentTool[]): string {
  return tools.map((t) => `- ${t.name}(${JSON.stringify(t.parameters)}): ${t.description}`).join("\n")
}

function buildToolResultBlock(toolName: string, result: string): string {
  return `[Tool ${toolName} result]: ${result.slice(0, 2000)}`
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    provider,
    model,
    systemPrompt,
    userMessage,
    tools,
    maxIterations = 25,
    maxTokens = 4096,
    onStep,
    signal,
  } = options

  const toolMap = new Map<string, AgentTool>()
  for (const tool of tools) {
    toolMap.set(tool.name, tool)
  }

  const toolList = buildToolList(tools)
  const systemContent = systemPrompt
    ? `${systemPrompt}\n\nYou are an AI agent that can use tools to accomplish tasks. ` +
      `When you need to use a tool, respond with EXACTLY:\nCALL_TOOL: toolName(arguments)\n` +
      `After calling a tool you will receive the result. Continue this loop until the task is complete.\n` +
      `When you have the final answer, respond with:\nFINAL_ANSWER: your response here\n\n` +
      `Available tools:\n${toolList}`
    : `You are an AI agent that can use tools. ` +
      `Use CALL_TOOL: toolName(args) to call a tool.\n` +
      `Use FINAL_ANSWER: your response when done.\n\n` +
      `Available tools:\n${toolList}`

  const messages: CompletionRequest["messages"] = [
    { role: "system", content: systemContent },
    { role: "user", content: userMessage },
  ]

  const allSteps: AgentLoopStep[] = []
  let totalPromptTokens = 0
  let totalCompletionTokens = 0

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal?.aborted) {
      throw new Error("Agent loop aborted")
    }

    const req: CompletionRequest = {
      model,
      messages: [...messages],
      maxTokens,
      temperature: 0.7,
    }

    let result: CompletionResult
    try {
      result = await provider.complete(req)
    } catch (err) {
      const errorMsg = `[LLM error: ${err instanceof Error ? err.message : String(err)}]`
      onStep?.({ type: "error", content: errorMsg })
      allSteps.push({ type: "error", content: errorMsg })
      return buildResult(model, userMessage, systemPrompt, errorMsg, iteration + 1, allSteps, totalPromptTokens, totalCompletionTokens)
    }

    const response = extractTextContent(result.message.content) || ""
    totalPromptTokens += result.usage.prompt_tokens
    totalCompletionTokens += result.usage.completion_tokens

    onStep?.({ type: "thought", content: response })
    allSteps.push({ type: "thought", content: response })

    const finalMatch = response.match(FINAL_ANSWER_PATTERN)
    if (finalMatch) {
      const answer = finalMatch[1]!.trim()
      return buildResult(model, userMessage, systemPrompt, answer, iteration + 1, allSteps, totalPromptTokens, totalCompletionTokens)
    }

    const toolMatch = response.match(TOOL_USE_PATTERN)
    if (toolMatch) {
      const toolName = toolMatch[1]!
      const rawArgs = toolMatch[2]!

      let toolArgs: Record<string, unknown>
      try {
        toolArgs = JSON.parse(rawArgs) || {}
      } catch {
        toolArgs = { input: rawArgs }
      }

      onStep?.({ type: "tool_call", content: `${toolName}(${rawArgs})`, toolName, toolArgs })
      allSteps.push({ type: "tool_call", content: `${toolName}(${rawArgs})`, toolName, toolArgs })

      let toolResult: string
      const tool = toolMap.get(toolName)
      if (tool) {
        try {
          toolResult = await tool.execute(toolArgs)
        } catch (err) {
          toolResult = `[Tool ${toolName} error: ${err instanceof Error ? err.message : String(err)}]`
        }
      } else {
        const available = Array.from(toolMap.keys()).join(", ")
        toolResult = `[Tool "${toolName}" not found. Available: ${available}]`
      }

      const truncatedResult = toolResult.slice(0, 2000)
      onStep?.({ type: "tool_result", content: truncatedResult, toolName })
      allSteps.push({ type: "tool_result", content: truncatedResult, toolName })

      messages.push({ role: "assistant", content: response })
      messages.push({ role: "user", content: buildToolResultBlock(toolName, toolResult) })
      continue
    }

    return buildResult(model, userMessage, systemPrompt, response, iteration + 1, allSteps, totalPromptTokens, totalCompletionTokens)
  }

  return buildResult(
    model,
    userMessage,
    systemPrompt,
    `[Max iterations (${maxIterations}) reached]`,
    maxIterations,
    allSteps,
    totalPromptTokens,
    totalCompletionTokens,
    true,
  )
}

function buildResult(
  model: string,
  userMessage: string,
  systemPrompt: string,
  response: string,
  iterations: number,
  steps: AgentLoopStep[],
  promptTokens: number,
  completionTokens: number,
  truncated = false,
): AgentLoopResult {
  return {
    response,
    iterations,
    steps,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  }
}
