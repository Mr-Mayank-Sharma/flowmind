import { Command } from "commander"
import { getMCPServers, addMCPServer, deleteMCPServer } from "../store/index.js"
import { title, statusDot, badge, keyValue } from "../utils/display.js"
import chalk from "chalk"

export function registerMCPCommands(program: Command): void {
  const mcp = program.command("mcp").description("Manage MCP servers")

  mcp
    .command("list")
    .description("List all MCP servers")
    .action(() => {
      const servers = getMCPServers()
      title(`MCP Servers (${servers.length})`)

      const connected = servers.filter(s => s.status === "connected").length
      const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0)
      console.log(`  ${chalk.dim(`${connected}/${servers.length} connected · ${totalTools} available tools`)}`)
      console.log()

      for (const s of servers) {
        const statusColor = s.status === "connected" ? "green" : s.status === "error" ? "red" : "dim"
        console.log(`  ${statusDot(s.status)} ${chalk.bold(s.name)} ${badge(s.type, "cyan")}`)
        console.log(`    ${chalk.dim(s.description)}`)
        console.log(`    ${keyValue("Tools", s.tools.join(", "))}`)
        console.log(`    ${keyValue("Last Active", s.lastActive)}`)
        if (s.url) console.log(`    ${keyValue("URL", s.url)}`)
        if (s.command) console.log(`    ${keyValue("Command", s.command)}`)
        console.log()
      }
    })

  mcp
    .command("add")
    .description("Add an MCP server")
    .requiredOption("-n, --name <name>", "Server name")
    .option("-u, --url <url>", "Server URL (for SSE type)")
    .option("-c, --command <cmd>", "Start command (for stdio type)")
    .option("-d, --description <desc>", "Description", "Custom MCP server")
    .action((options) => {
      const type = options.url ? "sse" : options.command ? "stdio" : "built-in"
      addMCPServer({
        id: "s" + Date.now(),
        name: options.name,
        description: options.description,
        type,
        status: "disconnected",
        tools: [],
        lastActive: "never",
        url: options.url,
        command: options.command,
      })
      console.log(chalk.green(`  ✓ MCP server "${options.name}" added`))
    })

  mcp
    .command("remove")
    .description("Remove an MCP server")
    .requiredOption("-i, --id <id>", "Server ID")
    .action((options) => {
      deleteMCPServer(options.id)
      console.log(chalk.green(`  ✓ MCP server ${options.id} removed`))
    })
}
