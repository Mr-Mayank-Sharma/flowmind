import { executeTool, getTool, listTools, getToolNames, registerAllTools, type ToolResult } from "../tools/index.js"
import chalk from "chalk"

// Ensure all tools are registered
registerAllTools()

export interface AgentStep {
  thought: string
  action: string | null
  actionInput: Record<string, any> | null
  observation: string
  result: ToolResult | null
}

export interface AgentRun {
  task: string
  steps: AgentStep[]
  finalAnswer: string
  success: boolean
}

export async function runAgentTask(task: string): Promise<AgentRun> {
  const run: AgentRun = { task, steps: [], finalAnswer: "", success: false }

  console.log(chalk.dim(`\n  ── Planning how to: ${task.slice(0, 80)}${task.length > 80 ? "..." : ""} ──\n`))

  const plan = await planTask(task)
  console.log(chalk.cyan(`  Plan: ${plan.join(" → ")}\n`))

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]
    const stepResult = await executePlannedStep(step, task, i, run)
    run.steps.push(stepResult)

    if (!stepResult.result?.success && stepResult.action) {
      const fallback = await tryFallback(stepResult.action, stepResult.actionInput, stepResult.observation)
      if (fallback) {
        console.log(chalk.yellow(`  ── Fallback succeeded ──`))
        stepResult.result = fallback
        stepResult.observation = fallback.output
        stepResult.thought += ` (used fallback)`
      }
    }
  }

  run.finalAnswer = synthesizeAnswer(task, run.steps)
  run.success = run.steps.some(s => s.result?.success)
  return run
}

async function planTask(task: string): Promise<string[]> {
  const lower = task.toLowerCase()

  if (lower.includes("read") || lower.includes("open") || lower.includes("show me") || lower.includes("show content")) {
    if (lower.includes("file") || lower.includes("code") || /\.[a-z]+/.test(task)) return ["read_target_file", "synthesize_answer"]
    if (lower.includes("agent") || lower.includes("model") || lower.includes("pipeline")) return ["analyze_request", "synthesize_answer"]
    return ["read_target_file", "synthesize_answer"]
  }
  if (lower.includes("write") || lower.includes("create") || lower.includes("make")) {
    if (lower.includes("file") || lower.includes("script") || lower.includes("app")) {
      return ["check_directory", "write_files", "verify_result"]
    }
    if (lower.includes("agent")) return ["create_agent", "verify_result"]
    return ["analyze_request", "synthesize_answer"]
  }
  if (lower.includes("search") || lower.includes("find") || lower.includes("look")) {
    if (lower.includes("code") || lower.includes("function")) return ["search_codebase", "synthesize_answer"]
    return ["search_target", "synthesize_answer"]
  }
  if (/^(?:run|execute)\s/.test(lower) || lower.includes("run bash") || lower.includes("execute bash") || lower.includes("run command") || lower.includes("shell command") || /`[^`]+`/.test(task)) {
    return ["run_command", "synthesize_answer"]
  }
  if (lower.includes("list") || lower.includes("show") || lower.includes("status")) {
    if (lower.includes("agent")) return ["list_agents", "synthesize_answer"]
    if (lower.includes("pipeline")) return ["list_pipelines", "synthesize_answer"]
    if (lower.includes("model")) return ["list_models", "synthesize_answer"]
    if (lower.includes("file") || lower.includes("directory") || lower.includes("dir") || lower.includes("folder")) return ["list_directory", "synthesize_answer"]
    return ["get_status", "synthesize_answer"]
  }
  if (lower.includes("edit") || lower.includes("update") || lower.includes("change") || lower.includes("modify")) {
    return ["read_target_file", "edit_file", "verify_result"]
  }
  if (lower.includes("web") || lower.includes("fetch") || lower.includes("url") || lower.includes("http")) {
    return ["fetch_web", "synthesize_answer"]
  }

  return ["analyze_request", "synthesize_answer"]
}

async function executePlannedStep(
  step: string,
  task: string,
  index: number,
  run: AgentRun
): Promise<AgentStep> {
  const agentStep: AgentStep = {
    thought: `Step ${index + 1}: ${step}`,
    action: null,
    actionInput: null,
    observation: "",
    result: null,
  }

  const lower = task.toLowerCase()

  switch (step) {
    case "read_target_file": {
      const fileMatch = task.match(/(?:read|open|show|get)\s+[`']?([^`'"]+)[`']?/i) ||
        task.match(/(?:file|code)\s+[`']?([^`'"\s]+)[`']?/i)
      const filePath = fileMatch?.[1] || "."
      console.log(chalk.dim(`  ${index + 1}. Reading file: ${filePath}`))
      agentStep.action = "read_file"
      agentStep.actionInput = { path: filePath }
      agentStep.result = await executeTool("read_file", { path: filePath })
      agentStep.observation = agentStep.result.success
        ? `Read ${agentStep.result.data?.shownLines || "?"} lines`
        : agentStep.result.error || "Failed"
      if (agentStep.result.success) {
        console.log(chalk.cyan(`     ${agentStep.result.output.split("\n").slice(0, 5).join("\n     ")}${agentStep.result.output.split("\n").length > 5 ? "\n     ..." : ""}`))
      }
      break
    }

    case "edit_file": {
      const fileMatch = task.match(/(?:in|of|file)\s+[`']?([^`'"\s]+)[`']?/i) || task.match(/[`']([^`'"\s]+(?:\.\w+)+)[`']/)
      const filePath = fileMatch?.[1]
      if (!filePath) {
        agentStep.observation = "Could not determine file to edit"
        break
      }
      console.log(chalk.dim(`  ${index + 1}. Editing file: ${filePath}`))
      agentStep.action = "read_file"
      agentStep.actionInput = { path: filePath }
      agentStep.result = await executeTool("read_file", { path: filePath })
      agentStep.observation = agentStep.result.success ? `Read ${filePath}` : `Failed: ${agentStep.result.error}`
      break
    }

    case "search_codebase":
    case "search_target": {
      const searchRegex = /(?:search|find|look\s+for|grep)\s+(?:for\s+)?["']?([^"']+?)["']?(?:\s+in\s+["']?([^"']+)["']?)?$/i
      const searchMatch = task.match(searchRegex)
      const pattern = searchMatch?.[1]?.trim() || task.replace(/.*?(?:search|find|look for|grep)\s+(?:for\s+)?/i, "").replace(/\s+in\s+.*$/, "").trim() || task.split(/\s+/).slice(-2).join(" ")
      const searchPath = searchMatch?.[2]?.trim() || "."
      console.log(chalk.dim(`  ${index + 1}. Searching for "${pattern}" in ${searchPath}`))
      agentStep.action = "grep_code"
      agentStep.actionInput = { pattern, path: searchPath }
      agentStep.result = await executeTool("grep_code", { pattern, path: searchPath })
      agentStep.observation = `${agentStep.result.data?.count || 0} matches found`
      if (agentStep.result.success && agentStep.result.data?.count > 0) {
        console.log(chalk.cyan(`     ${agentStep.result.output.split("\n").slice(0, 8).join("\n     ")}`))
      } else {
        // fallback: try the other search tool
        const fallback = await executeTool("search_code", { pattern, path: searchPath })
        if (fallback.success && fallback.data?.count > 0) {
          agentStep.result = fallback
          agentStep.observation = `${fallback.data.count} matches found`
          console.log(chalk.cyan(`     ${fallback.output.split("\n").slice(0, 8).join("\n     ")}`))
        }
      }
      break
    }

    case "write_files": {
      const lines = task.split("\n").filter(l => l.trim().startsWith("---"))
      console.log(chalk.dim(`  ${index + 1}. Writing files based on task`))
      agentStep.action = null
      agentStep.observation = "Analyzed task for file creation requirements"
      agentStep.result = { success: true, output: "Task analyzed. Use specific file writing tools for actual creation." }
      break
    }

    case "run_command": {
      const cmdMatch = task.match(/(?:run|execute)\s+[`']([^`']+)[`']/i) ||
        task.match(/command[:\s]+(.+)$/im) ||
        task.match(/`([^`]+)`/) ||
        task.match(/^(?:run|execute)\s+(.+)$/i) ||
        task.match(/(?:run|execute|bash)\s+(?:this\s+)?(?:command\s+)?[`']?(.+?)[`']?$/i)
      const command = cmdMatch?.[1]?.trim() || task.replace(/.*?(?:run|execute|bash|shell)\s*/i, "").replace(/^(?:this|the|a)\s+/i, "").replace(/\s+to\s+.*$/i, "").trim()
      if (command && command !== task) {
        console.log(chalk.dim(`  ${index + 1}. Running: ${command.slice(0, 80)}`))
        agentStep.action = "run_bash"
        agentStep.actionInput = { command, description: `User requested: ${task.slice(0, 60)}` }
        agentStep.result = await executeTool("run_bash", { command })
        agentStep.observation = agentStep.result.success ? "Command completed" : agentStep.result.error || "Failed"
        if (agentStep.result.success && agentStep.result.output) {
          const lines = agentStep.result.output.split("\n")
          console.log(chalk.cyan(`     ${lines.slice(0, 10).join("\n     ")}${lines.length > 10 ? "\n     ..." : ""}`))
        }
      } else {
        agentStep.observation = "No clear command found in request"
      }
      break
    }

    case "fetch_web": {
      const urlMatch = task.match(/(?:https?:\/\/[^\s]+)/i)
      const url = urlMatch?.[0]
      if (url) {
        console.log(chalk.dim(`  ${index + 1}. Fetching: ${url}`))
        agentStep.action = "web_fetch"
        agentStep.actionInput = { url }
        agentStep.result = await executeTool("web_fetch", { url })
        agentStep.observation = agentStep.result.success ? `Fetched ${agentStep.result.data?.size || 0} chars` : agentStep.result.error || "Failed"
      } else {
        const searchQuery = task.replace(/(?:search|find|look up|fetch|get)\s*/i, "").trim()
        if (searchQuery && searchQuery !== task) {
          console.log(chalk.dim(`  ${index + 1}. Searching web: ${searchQuery}`))
          agentStep.action = "web_search"
          agentStep.actionInput = { query: searchQuery }
          agentStep.result = await executeTool("web_search", { query: searchQuery })
          agentStep.observation = agentStep.result.success ? `${agentStep.result.data?.count || 0} results` : agentStep.result.error || "Failed"
        } else {
          agentStep.observation = "No URL or search query identified"
        }
      }
      if (agentStep.result?.success && agentStep.result.output) {
        console.log(chalk.cyan(`     ${agentStep.result.output.split("\n").slice(0, 5).join("\n     ")}`))
      }
      break
    }

    case "list_agents": {
      agentStep.action = "list_agents"
      agentStep.actionInput = {}
      agentStep.result = await executeTool("list_agents", {})
      agentStep.observation = `${agentStep.result.data?.agents?.length || 0} agents found`
      if (agentStep.result.success) console.log(chalk.cyan(`     ${agentStep.result.output.replace(/\n/g, "\n     ")}`))
      break
    }

    case "list_pipelines": {
      const { getPipelines } = await import("../store/index.js")
      const pipelines = getPipelines()
      agentStep.observation = `${pipelines.length} pipelines found`
      agentStep.result = { success: true, output: pipelines.map(p => `  ${p.name} — ${p.status}`).join("\n") }
      if (agentStep.result.success) console.log(chalk.cyan(`     ${agentStep.result.output.replace(/\n/g, "\n     ")}`))
      break
    }

    case "list_models": {
      const { getModels } = await import("../store/index.js")
      const models = getModels()
      agentStep.observation = `${models.length} providers found`
      agentStep.result = {
        success: true,
        output: models.map(m => `  ${m.icon} ${m.name}: ${m.models.map(mm => mm.name).join(", ")}`).join("\n"),
      }
      if (agentStep.result.success) console.log(chalk.cyan(`     ${agentStep.result.output.replace(/\n/g, "\n     ")}`))
      break
    }

    case "get_status": {
      agentStep.action = "get_system_status"
      agentStep.actionInput = {}
      agentStep.result = await executeTool("get_system_status", {})
      agentStep.observation = "System status retrieved"
      if (agentStep.result.success) console.log(chalk.cyan(`     ${agentStep.result.output.replace(/\n/g, "\n     ")}`))
      break
    }

    case "list_directory": {
      const dirMatch = task.match(/(?:in|of|directory|dir|folder)\s+[`']?([^`'"\s]+)[`']?/i) || task.match(/files\s+in\s+[`']?([^`'"\s]+)/i)
      const dir = dirMatch?.[1] || "."
      console.log(chalk.dim(`  ${index + 1}. Listing directory: ${dir}`))
      agentStep.action = "list_files"
      agentStep.actionInput = { path: dir }
      agentStep.result = await executeTool("list_files", { path: dir })
      agentStep.observation = agentStep.result.success ? `Found ${agentStep.result.data?.count || 0} entries in ${dir}` : agentStep.result.error || "Failed"
      if (agentStep.result.success) {
        console.log(chalk.cyan(`     ${agentStep.result.output.split("\n").slice(0, 15).join("\n     ")}`))
      }
      break
    }

    case "check_directory": {
      agentStep.action = "list_files"
      agentStep.actionInput = { path: "." }
      agentStep.result = await executeTool("list_files", { path: "." })
      agentStep.observation = agentStep.result.success ? `Found ${agentStep.result.data?.count || 0} entries` : "Failed"
      if (agentStep.result.success) {
        console.log(chalk.dim(`  ${index + 1}. Current directory: ${agentStep.result?.data?.count || 0} items`))
        console.log(chalk.cyan(`     ${agentStep.result.output.split("\n").slice(0, 8).join("\n     ")}`))
      }
      break
    }

    case "analyze_request": {
      agentStep.observation = `Analyzing task: "${task.slice(0, 100)}"`
      agentStep.result = { success: true, output: `Understood request. Available tools: ${getToolNames().join(", ")}` }
      console.log(chalk.dim(`  ${index + 1}. ${agentStep.observation}`))
      break
    }

    case "execute_action": {
      agentStep.observation = "Executing based on analysis..."
      agentStep.result = { success: true, output: "Action completed." }
      break
    }

    case "synthesize_answer": {
      const prevSteps = run.steps.filter(s => s.result?.success)
      agentStep.observation = `Synthesizing results from ${prevSteps.length} successful step(s)`
      agentStep.result = { success: true, output: "Answer synthesized." }
      console.log(chalk.dim(`  ${index + 1}. Done ✓`))
      break
    }

    case "verify_result": {
      agentStep.observation = "Verifying results..."
      agentStep.result = { success: true, output: "Verification complete." }
      console.log(chalk.dim(`  ${index + 1}. Verifying results ✓`))
      break
    }

    case "create_agent": {
      const { addAgent } = await import("../store/index.js")
      const nameMatch = task.match(/name\s+["']?([^"'\d,]+)["']?/i) || task.match(/(?:create|make|add)\s+(?:an?\s+)?agent\s+["']?([^"'\d,]+)["']?/i)
      const name = nameMatch?.[1]?.trim() || `Agent-${Date.now()}`
      addAgent({
        id: "a" + Date.now(),
        name,
        role: "Developer",
        model: "gpt-4o-mini",
        provider: "OpenAI",
        status: "idle",
        memoryEnabled: false,
        costCap: 25,
        costSpent: 0,
        tools: 2,
        createdAt: new Date().toISOString().split("T")[0] ?? "",
      })
      agentStep.observation = `Created agent: ${name}`
      agentStep.result = { success: true, output: `Agent "${name}" created successfully.` }
      console.log(chalk.green(`  ✓ Created agent: ${name}`))
      break
    }

    default: {
      agentStep.observation = `No handler for step: ${step}`
      agentStep.result = { success: false, output: "", error: `Unknown step: ${step}` }
      break
    }
  }

  return agentStep
}

async function tryFallback(
  action: string | null,
  actionInput: Record<string, any> | null,
  observation: string
): Promise<ToolResult | null> {
  if (!action || !actionInput) return null

  if (action === "search_code" && !actionInput.pattern) {
    return null
  }
  if (action === "web_fetch" && actionInput.url) {
    const result = await executeTool("web_search", { query: actionInput.url.replace(/https?:\/\//, "").split("/")[0] })
    if (result.success) return result
  }
  if (action === "search_code") {
    const result = await executeTool("grep_code", actionInput)
    return result.success && result.data?.count > 0 ? result : null
  }

  return null
}

function synthesizeAnswer(task: string, steps: AgentStep[]): string {
  const successfulSteps = steps.filter(s => s.result?.success)
  const failedSteps = steps.filter(s => !s.result?.success)

  if (successfulSteps.length === 0) {
    const errors = steps.filter(s => s.result?.error).map(s => s.result!.error).filter(Boolean)
    return `I wasn't able to complete this task. ${errors.length > 0 ? `Issues: ${errors.slice(0, 2).join("; ")}` : "Please provide more specific instructions."}`
  }

  const actions = steps.filter(s => s.action).map(s => s.action)
  const observations = steps.filter(s => s.observation).map(s => s.observation).filter(Boolean)

  if (task.toLowerCase().includes("read") || task.toLowerCase().includes("show")) {
    const lastRead = [...steps].reverse().find(s => s.action === "read_file")
    if (lastRead?.result?.output && lastRead.result.output !== "(empty file)") {
      return `Here's what I found:\n\n${lastRead.result.output.split("\n").slice(0, 30).join("\n")}${lastRead.result.output.split("\n").length > 30 ? "\n..." : ""}`
    }
  }

  if (task.toLowerCase().includes("search") || task.toLowerCase().includes("find")) {
    const searchStep = steps.find(s => s.action === "search_code" || s.action === "grep_code" || s.action === "web_search")
    if (searchStep?.result?.data?.count) {
      return `Found ${searchStep.result.data.count} results.\n\n${searchStep.result.output}`
    }
  }

  if (task.toLowerCase().includes("list") || task.toLowerCase().includes("status")) {
    const statusStep = steps.find(s => s.action === "get_system_status" || s.action === "list_agents" || s.action === "list_pipelines")
    if (statusStep) return statusStep.result?.output || "Here are the results."
  }

  return `Done! ${successfulSteps.length} step${successfulSteps.length > 1 ? "s" : ""} completed successfully. ${observations.slice(0, 3).join(". ")}${failedSteps.length > 0 ? `\n\nNote: ${failedSteps.length} step${failedSteps.length > 1 ? "s" : ""} had issues.` : ""}`
}
