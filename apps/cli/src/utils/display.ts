import chalk from "chalk"

export function title(text: string): void {
  const line = "─".repeat(text.length + 8)
  console.log()
  console.log(chalk.cyan(`  ┌${line}┐`))
  console.log(chalk.cyan(`  │   `) + chalk.bold(text) + chalk.cyan(`   │`))
  console.log(chalk.cyan(`  └${line}┘`))
  console.log()
}

export function section(text: string): void {
  console.log()
  console.log(chalk.dim("── ") + chalk.bold.white(text))
  console.log()
}

export function statusDot(status: string): string {
  const dots: Record<string, string> = {
    active: chalk.green("●"),
    idle: chalk.yellow("○"),
    error: chalk.red("●"),
    paused: chalk.dim("○"),
    running: chalk.blue("●"),
    connected: chalk.green("●"),
    disconnected: chalk.dim("●"),
    success: chalk.green("●"),
    denied: chalk.red("●"),
  }
  return dots[status] || chalk.dim("○")
}

export function badge(text: string, color: "green" | "yellow" | "red" | "blue" | "dim" | "cyan" = "dim"): string {
  const colors = { green: chalk.green, yellow: chalk.yellow, red: chalk.red, blue: chalk.blue, dim: chalk.dim, cyan: chalk.cyan }
  return colors[color](` ${text} `)
}

export function keyValue(key: string, value: string): string {
  return `  ${chalk.dim(key + ":")} ${value}`
}

export function table(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] || "").length))
  )
  const sep = colWidths.map(w => "─".repeat(w + 2)).join("┬")
  const headerLine = headers.map((h, i) => chalk.bold(h.padEnd(colWidths[i]))).join(" │ ")
  console.log(`  ${headerLine}`)
  console.log(`  ${sep}`)
  for (const row of rows) {
    const line = row.map((cell, i) => (cell || "").padEnd(colWidths[i])).join(" │ ")
    console.log(`  ${line}`)
  }
  console.log()
}

export function helpText(): void {
  console.log()
  console.log(chalk.bold("  FlowMind CLI — Interactive AI Agent Framework"))
  console.log()
  console.log(chalk.dim("  Usage: flowmind <command> [options]"))
  console.log()
  console.log(chalk.bold("  Commands:"))
  console.log(chalk.cyan("    interactive  ") + chalk.dim("  Start interactive REPL mode"))
  console.log(chalk.cyan("    chat        ") + chalk.dim("  Start a chat session with an agent"))
  console.log(chalk.cyan("    agent       ") + chalk.dim("  Manage AI agents"))
  console.log(chalk.cyan("    model       ") + chalk.dim("  Browse and configure models"))
  console.log(chalk.cyan("    pipeline    ") + chalk.dim("  Manage pipelines"))
  console.log(chalk.cyan("    mcp         ") + chalk.dim("  Manage MCP servers"))
  console.log(chalk.cyan("    context     ") + chalk.dim("  View context sessions"))
  console.log(chalk.cyan("    governance  ") + chalk.dim("  View governance data"))
  console.log()
  console.log(chalk.bold("  Interactive mode slash commands:"))
  console.log(chalk.dim("    /help       ") + chalk.dim("  Show available commands"))
  console.log(chalk.dim("    /agents     ") + chalk.dim("  List and manage agents"))
  console.log(chalk.dim("    /chat       ") + chalk.dim("  Start a new chat"))
  console.log(chalk.dim("    /models     ") + chalk.dim("  Browse models"))
  console.log(chalk.dim("    /pipelines  ") + chalk.dim("  List pipelines"))
  console.log(chalk.dim("    /mcp        ") + chalk.dim("  MCP server status"))
  console.log(chalk.dim("    /context    ") + chalk.dim("  View sessions"))
  console.log(chalk.dim("    /governance ") + chalk.dim("  View audit & RBAC"))
  console.log(chalk.dim("    /exit       ") + chalk.dim("  Exit interactive mode"))
  console.log()
  console.log(chalk.dim("  Examples:"))
  console.log(chalk.dim("    flowmind interactive"))
  console.log(chalk.dim("    flowmind agent list"))
  console.log(chalk.dim("    flowmind agent create --name MyAgent --role Developer"))
  console.log(chalk.dim("    flowmind chat --agent a1"))
  console.log()
}

export function interactiveHelpText(): void {
  console.log()
  console.log(chalk.bold("  Interactive Mode Commands:"))
  console.log()
  console.log(`  ${chalk.cyan("/help")}       ${chalk.dim("Show this help message")}`)
  console.log(`  ${chalk.cyan("/agents")}     ${chalk.dim("List all agents with status")}`)
  console.log(`  ${chalk.cyan("/agent <id>")} ${chalk.dim("Show agent details")}`)
  console.log(`  ${chalk.cyan("/chat")}       ${chalk.dim("Enter chat mode with an agent")}`)
  console.log(`  ${chalk.cyan("/models")}     ${chalk.dim("List available models")}`)
  console.log(`  ${chalk.cyan("/pipelines")}  ${chalk.dim("List all pipelines")}`)
  console.log(`  ${chalk.cyan("/mcp")}        ${chalk.dim("Show MCP server status")}`)
  console.log(`  ${chalk.cyan("/context")}    ${chalk.dim("List active sessions")}`)
  console.log(`  ${chalk.cyan("/governance")} ${chalk.dim("Show governance summary")}`)
  console.log(`  ${chalk.cyan("/status")}     ${chalk.dim("Show system overview")}`)
  console.log(`  ${chalk.cyan("/exit")}       ${chalk.dim("Exit interactive mode")}`)
  console.log()
  console.log(chalk.dim("  Or just type anything to chat with the AI assistant."))
  console.log()
}
