import { Command } from "commander"
import { getSessions } from "../store/index.js"
import { title, statusDot, keyValue } from "../utils/display.js"
import chalk from "chalk"

export function registerContextCommands(program: Command): void {
  const context = program.command("context").description("View context engine sessions")

  context
    .command("sessions")
    .alias("list")
    .description("List active sessions")
    .action(() => {
      const sessions = getSessions()
      title(`Context Sessions (${sessions.length})`)
      if (sessions.length === 0) {
        console.log(chalk.dim("  No active sessions."))
        return
      }
      for (const s of sessions) {
        const statusColor = s.status === "active" ? "green" : s.status === "idle" ? "yellow" : "dim"
        console.log(`  ${statusDot(s.status)} ${chalk.bold(s.name)}`)
        console.log(`    ${keyValue("Agent", s.agentName)}`)
        console.log(`    ${keyValue("Tokens", (s.tokens / 1000).toFixed(1) + "K")}  ${keyValue("Memories", String(s.memoryCount))}  ${keyValue("Last Active", s.lastActive)}`)
        console.log()
      }
    })
}
