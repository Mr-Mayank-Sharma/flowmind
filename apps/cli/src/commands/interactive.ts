import { createInterface } from "readline"
import { getAgents, getModels, getPipelines, getMCPServers, getSessions } from "../store/index.js"
import { chatWithModel } from "../utils/ai.js"
import { interactiveHelpText, statusDot, badge, title, section } from "../utils/display.js"
import chalk from "chalk"

export async function startInteractiveMode(): Promise<void> {
  console.clear()
  console.log()
  console.log(chalk.bold.cyan(`  ╔══════════════════════════════════════╗`))
  console.log(chalk.bold.cyan(`  ║`) + chalk.bold.white(`        FlowMind AI Terminal         `) + chalk.bold.cyan(`║`))
  console.log(chalk.bold.cyan(`  ║`) + chalk.dim(`     Open-Source Agent Framework      `) + chalk.bold.cyan(`║`))
  console.log(chalk.bold.cyan(`  ╚══════════════════════════════════════╝`))
  console.log()
  console.log(chalk.dim(`  Type /help for commands, or just start typing.`))
  console.log()

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("flowmind> "),
  })

  rl.prompt()

  rl.on("line", async (line: string) => {
    const input = line.trim()
    if (!input) { rl.prompt(); return }

    if (input.startsWith("/")) {
      handleSlashCommand(input)
      rl.prompt()
    } else {
      await handleFreeForm(input)
      rl.prompt()
    }
  })

  rl.on("close", () => {
    console.log(chalk.green("\n  Goodbye!"))
    process.exit(0)
  })
}

async function handleFreeForm(input: string): Promise<void> {
  console.log()
  console.log(`  ${chalk.green("FlowMind Agent:")} Let me work on that...`)
  console.log()

  const response = await chatWithModel([{ role: "user", content: input }])

  console.log()
  console.log(`  ${chalk.green("Result:")} ${response.content}`)
  console.log()
}

function handleSlashCommand(input: string): void {
  const parts = input.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (cmd) {
    case "/help":
      interactiveHelpText()
      break

    case "/agents":
      showAgents()
      break

    case "/agent":
      if (args[0]) showAgentDetail(args[0])
      else showAgents()
      break

    case "/models":
      showModels()
      break

    case "/pipelines":
      showPipelines()
      break

    case "/mcp":
      showMCP()
      break

    case "/context":
      showContext()
      break

    case "/governance":
      showGovernance()
      break

    case "/status":
      showStatus()
      break

    case "/exit":
    case "/quit":
      console.log(chalk.green("\n  Goodbye!"))
      process.exit(0)
      break

    default:
      console.log(chalk.yellow(`  Unknown command: ${cmd}`))
      console.log(chalk.dim(`  Type /help for available commands.`))
  }
}

function showAgents(): void {
  const agents = getAgents()
  if (agents.length === 0) {
    console.log(chalk.dim("\n  No agents. Use 'flowmind agent create' to add one.\n"))
    return
  }
  console.log()
  for (const a of agents) {
    console.log(`  ${statusDot(a.status)} ${chalk.bold(a.name)} ${badge(a.role, "cyan")} ${chalk.dim(a.id)}`)
    console.log(`    ${chalk.dim(`Model: ${a.model} · Memory: ${a.memoryEnabled ? "on" : "off"} · Cost: $${a.costSpent}/${a.costCap}`)}`)
  }
  console.log()
}

function showAgentDetail(id: string): void {
  const agents = getAgents()
  const a = agents.find(a => a.id === id)
  if (!a) {
    console.log(chalk.red(`\n  Agent "${id}" not found.\n`))
    return
  }
  console.log()
  title(a.name)
  console.log(`  Status:  ${statusDot(a.status)} ${a.status}`)
  console.log(`  Role:    ${a.role}`)
  console.log(`  Model:   ${a.model} (${a.provider})`)
  console.log(`  Memory:  ${a.memoryEnabled ? chalk.green("Enabled") : chalk.dim("Disabled")}`)
  console.log(`  Cost:    ${chalk.yellow(`$${a.costSpent}`)} / ${chalk.yellow(`$${a.costCap}`)}`)
  console.log(`  Tools:   ${a.tools}`)
  console.log()
}

function showModels(): void {
  const providers = getModels()
  console.log()
  for (const p of providers) {
    const keyStatus = p.apiKeyConfigured ? chalk.green("✓") : chalk.dim("no key")
    console.log(`  ${p.icon} ${chalk.bold(p.name)} ${keyStatus}`)
    for (const m of p.models) {
      const pricing = m.inputPrice === 0 ? chalk.green(" free") : chalk.dim(` $${m.inputPrice}M`)
      const ctx = chalk.dim(`${(m.contextWindow / 1000).toFixed(0)}K`)
      console.log(`    └ ${chalk.white(m.name)} ${ctx}${pricing}`)
    }
  }
  console.log()
}

function showPipelines(): void {
  const pipelines = getPipelines()
  if (pipelines.length === 0) {
    console.log(chalk.dim("\n  No pipelines.\n"))
    return
  }
  console.log()
  for (const p of pipelines) {
    const dot = p.status === "ACTIVE" ? chalk.green("●") : p.status === "DRAFT" ? chalk.yellow("○") : chalk.dim("○")
    console.log(`  ${dot} ${chalk.bold(p.name)} ${badge(p.status, p.status === "ACTIVE" ? "green" : "yellow")}`)
    console.log(`    ${chalk.dim(`${p.nodeCount} nodes · ${p.lastRunAt || "never run"}`)}`)
  }
  console.log()
}

function showMCP(): void {
  const servers = getMCPServers()
  const connected = servers.filter(s => s.status === "connected").length
  const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0)
  console.log()
  console.log(`  ${chalk.dim(`${connected}/${servers.length} connected · ${totalTools} tools`)}`)
  console.log()
  for (const s of servers) {
    const dot = s.status === "connected" ? chalk.green("●") : s.status === "error" ? chalk.red("●") : chalk.dim("●")
    console.log(`  ${dot} ${chalk.bold(s.name)} ${badge(s.type, "cyan")} ${chalk.dim(s.lastActive)}`)
    console.log(`    ${chalk.dim(s.tools.slice(0, 4).join(", ") + (s.tools.length > 4 ? "..." : ""))}`)
  }
  console.log()
}

function showContext(): void {
  const sessions = getSessions()
  if (sessions.length === 0) {
    console.log(chalk.dim("\n  No active sessions.\n"))
    return
  }
  console.log()
  for (const s of sessions) {
    const dot = s.status === "active" ? chalk.green("●") : s.status === "idle" ? chalk.yellow("○") : chalk.dim("○")
    console.log(`  ${dot} ${chalk.bold(s.name)} ${chalk.dim(`· ${s.agentName}`)}`)
    console.log(`    ${chalk.dim(`${(s.tokens / 1000).toFixed(0)}K tokens · ${s.memoryCount} memories · ${s.lastActive}`)}`)
  }
  console.log()
}

function showGovernance(): void {
  console.log()
  console.log(`  ${chalk.bold("RBAC Roles")}`)
  console.log(`  ${chalk.red("●")} ${chalk.bold("Admin")}     ${chalk.dim("Full access — 1 user")}`)
  console.log(`  ${chalk.blue("●")} ${chalk.bold("Developer")} ${chalk.dim("Create/edit agents & pipelines — 2 users")}`)
  console.log(`  ${chalk.yellow("●")} ${chalk.bold("Operator")} ${chalk.dim("Edit existing resources — 1 user")}`)
  console.log(`  ${chalk.dim("○")} ${chalk.bold("Viewer")}    ${chalk.dim("Read-only access — 2 users")}`)
  console.log()
  console.log(`  ${chalk.bold("Recent Audit Events")}`)
  const events = [
    ["agent.create", "Research Assistant", "success"],
    ["pipeline.execute", "Customer Support", "success"],
    ["settings.access", "API Keys", "denied"],
  ]
  for (const [action, resource, status] of events) {
    const dot = status === "success" ? chalk.green("●") : chalk.red("●")
    console.log(`  ${dot} ${chalk.cyan(action)} ${chalk.dim("on")} ${resource}`)
  }
  console.log()
}

function showStatus(): void {
  const agents = getAgents()
  const pipelines = getPipelines()
  const servers = getMCPServers()
  const sessions = getSessions()

  console.log()
  title("System Status")
  console.log(`  ${chalk.bold("Agents:")}      ${agents.filter(a => a.status === "active").length}/${agents.length} active`)
  console.log(`  ${chalk.bold("Pipelines:")}   ${pipelines.filter(p => p.status === "ACTIVE").length}/${pipelines.length} active`)
  console.log(`  ${chalk.bold("MCP Servers:")} ${servers.filter(s => s.status === "connected").length}/${servers.length} connected`)
  console.log(`  ${chalk.bold("Sessions:")}    ${sessions.filter(s => s.status === "active").length}/${sessions.length} active`)
  console.log()
}
