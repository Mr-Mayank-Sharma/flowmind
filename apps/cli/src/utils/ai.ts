import { getModels } from "../store/index.js"
import { runAgentTask } from "../engine/agent.js"
import { registerAllTools, listTools, getToolDescriptions } from "../tools/index.js"

registerAllTools()

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface AIResponse {
  content: string
  model: string
  provider: string
}

export async function chatWithModel(
  messages: ChatCompletionMessage[],
  modelName: string = "gpt-4o"
): Promise<AIResponse> {
  const lastMessage = messages[messages.length - 1]?.content || ""
  const lower = lastMessage.toLowerCase()

  // For actionable requests, use the real agent engine with tools
  if (isActionableRequest(lower)) {
    try {
      const result = await runAgentTask(lastMessage)
      return {
        content: result.finalAnswer,
        model: "flowmind-agent",
        provider: "FlowMind Engine",
      }
    } catch (err: any) {
      return {
        content: `I encountered an error while processing: ${err.message}\n\nLet me try a simpler response.\n\n${generateConversationalResponse(lastMessage)}`,
        model: modelName,
        provider: "FlowMind Engine",
      }
    }
  }

  // For conversational/general queries, use the AI response
  const models = getModels()
  const provider = models.find(m => m.models.some(mm => mm.name === modelName))
  const providerName = provider?.name || "OpenAI"

  if (provider?.apiKeyConfigured) {
    try {
      const response = await makeAPIRequest(messages, modelName, provider)
      if (response) return response
    } catch {}
  }

  return {
    content: generateConversationalResponse(lastMessage),
    model: modelName,
    provider: providerName,
  }
}

function isActionableRequest(text: string): boolean {
  const actionPatterns = [
    /^(read|show|open|get|display)\s+(file|code|content|the\s+)/i,
    /^(write|create|make|generate|build|add|new)\s+/i,
    /^(edit|update|change|modify|replace|rename)\s+/i,
    /^(delete|remove|destroy|clean|rm)\s+/i,
    /^(search|find|look\s+for|grep|find\s+in)\s+/i,
    /^(run|execute|start)\s+/i,
    /^(list|show\s+me|display)\s+(all\s+)?/i,
    /^(fetch|download|get)\s+(https?:\/\/|url|web)/i,
    /install\s+/i,
    /`[^`]+`/,
    /\.(ts|js|tsx|jsx|py|css|json|md)\b/,
  ]

  return actionPatterns.some(p => p.test(text))
}

export function generateConversationalResponse(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes("agent") || lower.includes("agents")) {
    return `Here's what I know about agents in FlowMind:\n\nAgents are AI-powered workers with specific roles (Researcher, Developer, Analyst, etc.). Each agent has a model, memory toggle, cost caps, and tool access. You can create agents with \`flowmind agent create\`, list them with \`flowmind agent list\`, or manage them in the interactive mode with \`/agents\`.`
  }
  if (lower.includes("model") || lower.includes("llm")) {
    return `FlowMind's Model Hub integrates with multiple providers:\n\n• OpenAI (gpt-4o, gpt-4o-mini)\n• Anthropic (claude-3 opus/sonnet/haiku)\n• Ollama (local: llama3, mistral, codellama)\n• Mistral AI, Google AI, Groq\n\nConfigure API keys with \`flowmind model configure <provider>\`.`
  }
  if (lower.includes("pipeline")) {
    return `Pipelines are directed graphs of AI operations. You can:\n\n• Create pipelines with visual node editors\n• Connect agents, models, and tools\n• Schedule recurring executions\n• Monitor runs and view logs\n\nSee \`flowmind pipeline list\` for your current pipelines.`
  }
  if (lower.includes("mcp")) {
    return `MCP (Model Context Protocol) Hub manages server connections that provide tools to agents.\n\nCurrently connected servers provide tools like file read/write, code review, database queries, and more. Use \`flowmind mcp list\` to see all servers.`
  }
  if (lower.includes("help") || lower.includes("what can") || lower.includes("capabilities") || lower.includes("what do")) {
    return `I'm FlowMind AI — your terminal AI agent framework. I can help you:\n\n• Manage AI agents with different roles\n• Configure model providers (OpenAI, Ollama, etc.)\n• Build and run pipelines\n• Connect MCP servers for tool access\n• View governance and audit logs\n• Chat with AI agents\n• **Execute tasks using tools** — read/write files, run commands, search code, fetch web content, and more!\n\nTry \`/help\` for available commands or just tell me what you'd like to do!`
  }
  if (lower.includes("hello") || lower.includes("hi ") || lower === "hi" || lower === "hey") {
    return `Hello! I'm FlowMind AI. I'm here to help you manage your AI agent framework. I can also execute tasks using my tools — try telling me to read a file, search code, run a command, or anything else you need!\n\nTry \`/help\` to see available commands.`
  }
  if (lower.includes("governance") || lower.includes("rbac") || lower.includes("audit")) {
    return `Governance in FlowMind provides:\n\n• RBAC Matrix: Role-based access control (Admin, Developer, Operator, Viewer)\n• Audit Log: Track all actions with timestamps and IP addresses\n• Permissions Editor: Granular permission configuration\n\nUse \`flowmind governance\` to view the full dashboard.`
  }
  if (lower.includes("tool") || lower.includes("what can you do")) {
    return `I have access to these tools:\n\n${getToolDescriptions()}\n\nJust ask me to do something like "read package.json", "search for 'function' in src/", or "list files in the current directory".`
  }
  if (lower.includes("thank")) {
    return `You're welcome! Let me know if you need anything else.`
  }
  if (lower.includes("who are you") || lower.includes("what are you")) {
    return `I'm FlowMind AI — an open-source AI agent framework running in your terminal. I combine the capabilities of an AI assistant with real tool execution. I can read/write files, run commands, search code, fetch web content, and manage AI agents — all from your command line.`
  }

  return `I understand you're asking about "${message.slice(0, 60)}${message.length > 60 ? "..." : ""}". To help you effectively, I can:\n\n• Execute tasks — tell me to read/write files, run commands, search code\n• Provide information about the FlowMind framework\n• Manage agents, pipelines, and models\n\nWhat would you like me to do?`
}

async function makeAPIRequest(
  messages: ChatCompletionMessage[],
  modelName: string,
  provider: any
): Promise<AIResponse | null> {
  if (provider.id === "ollama") {
    try {
      const response = await fetch(`${provider.baseUrl || "http://localhost:11434"}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          messages: messages.slice(-10),
          stream: false,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (response.ok) {
        const data = await response.json() as any
        return { content: data.message?.content || "", model: modelName, provider: provider.name }
      }
    } catch {}
  }
  return null
}

export function generateAgentResponse(
  agentName: string,
  agentRole: string,
  userMessage: string
): string {
  return `[${agentName} (${agentRole})]: I've processed your request regarding "${userMessage.slice(0, 50)}${userMessage.length > 50 ? "..." : ""}". As a ${agentRole.toLowerCase()}, I can help analyze and act on this. Would you like me to proceed with analysis or take a specific action?`
}
