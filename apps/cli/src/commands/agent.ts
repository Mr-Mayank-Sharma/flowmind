import { Command } from "commander"
import { getAgents, addAgent, deleteAgent, updateAgent } from "../store/index.js"
import { title, section, keyValue, statusDot, badge } from "../utils/display.js"
import chalk from "chalk"

export function registerAgentCommands(program: Command): void {
  const agent = program.command("agent").description("Manage AI agents")

  agent
    .command("list")
    .description("List all agents")
    .action(() => {
      const agents = getAgents()
      title(`Agents (${agents.length})`)
      if (agents.length === 0) {
        console.log(chalk.dim("  No agents yet. Create one with 'flowmind agent create'"))
        return
      }
      for (const a of agents) {
        const statusColor = a.status === "active" ? "green" : a.status === "error" ? "red" : a.status === "paused" ? "dim" : "yellow"
        console.log(`  ${statusDot(a.status)} ${chalk.bold(a.name)} ${badge(a.role, "cyan")}`)
        console.log(`    ${keyValue("Model", a.model)}  ${keyValue("Provider", a.provider)}`)
        console.log(`    ${keyValue("Memory", a.memoryEnabled ? chalk.green("enabled") : chalk.dim("disabled"))}  ${keyValue("Cost", chalk.yellow(`$${a.costSpent}/${a.costCap}`))}  ${keyValue("Tools", String(a.tools))}`)
        console.log()
      }
    })

  agent
    .command("create")
    .description("Create a new agent")
    .requiredOption("-n, --name <name>", "Agent name")
    .option("-r, --role <role>", "Agent role (Researcher, Developer, Analyst, Operator, Creator, Support)", "Developer")
    .option("-m, --model <model>", "Model name", "gpt-4o-mini")
    .option("-p, --provider <provider>", "Provider", "OpenAI")
    .action((options) => {
      const id = "a" + Date.now()
      addAgent({
        id,
        name: options.name,
        role: options.role,
        model: options.model,
        provider: options.provider,
        status: "idle",
        memoryEnabled: false,
        costCap: 25,
        costSpent: 0,
        tools: 2,
        createdAt: new Date().toISOString().split("T")[0] ?? "",
      })
      console.log(chalk.green(`  ✓ Agent "${options.name}" created (${id})`))
    })

  agent
    .command("delete")
    .description("Delete an agent")
    .requiredOption("-i, --id <id>", "Agent ID")
    .action((options) => {
      deleteAgent(options.id)
      console.log(chalk.green(`  ✓ Agent ${options.id} deleted`))
    })

  agent
    .command("toggle")
    .description("Toggle agent memory or status")
    .requiredOption("-i, --id <id>", "Agent ID")
    .option("--memory", "Toggle memory on/off")
    .option("--status", "Cycle status (active/idle/paused)")
    .action((options) => {
      if (options.memory) {
        const agents = getAgents()
        const agent = agents.find(a => a.id === options.id)
        if (agent) {
          updateAgent(options.id, { memoryEnabled: !agent.memoryEnabled })
          console.log(chalk.green(`  ✓ Memory ${agent.memoryEnabled ? "disabled" : "enabled"} for ${agent.name}`))
        }
      }
      if (options.status) {
        const agents = getAgents()
        const agent = agents.find(a => a.id === options.id)
        if (agent) {
          const cycle: Record<string, "active" | "idle" | "paused"> = { active: "idle", idle: "paused", paused: "active", error: "active" }
          const newStatus = cycle[agent.status] || "active"
          updateAgent(options.id, { status: newStatus })
          console.log(chalk.green(`  ✓ ${agent.name} status → ${newStatus}`))
        }
      }
    })

  agent
    .command("show")
    .description("Show agent details")
    .requiredOption("-i, --id <id>", "Agent ID")
    .action((options) => {
      const agents = getAgents()
      const a = agents.find(a => a.id === options.id)
      if (!a) {
        console.log(chalk.red(`  ✗ Agent ${options.id} not found`))
        return
      }
      title(a.name)
      console.log(`  ${keyValue("ID", a.id)}`)
      console.log(`  ${keyValue("Role", a.role)}`)
      console.log(`  ${keyValue("Model", a.model)}`)
      console.log(`  ${keyValue("Provider", a.provider)}`)
      console.log(`  ${keyValue("Status", statusDot(a.status) + " " + a.status)}`)
      console.log(`  ${keyValue("Memory", a.memoryEnabled ? chalk.green("Enabled") : chalk.dim("Disabled"))}`)
      console.log(`  ${keyValue("Cost Spent", chalk.yellow(`$${a.costSpent}`))}`)
      console.log(`  ${keyValue("Cost Cap", chalk.yellow(`$${a.costCap}`))}`)
      console.log(`  ${keyValue("Tools", String(a.tools))}`)
      console.log(`  ${keyValue("Created", a.createdAt)}`)
      console.log()
    })
}
