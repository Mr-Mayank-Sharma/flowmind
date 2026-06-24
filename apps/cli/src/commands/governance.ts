import { Command } from "commander"
import { title, statusDot, badge } from "../utils/display.js"
import chalk from "chalk"

interface AuditEntry {
  action: string
  resource: string
  user: string
  status: "success" | "denied" | "error"
  timestamp: string
}

const auditLog: AuditEntry[] = [
  { action: "agent.create", resource: "Research Assistant", user: "Mayank Sharma", status: "success", timestamp: "2025-06-24 14:32:18" },
  { action: "pipeline.execute", resource: "Customer Support", user: "Mayank Sharma", status: "success", timestamp: "2025-06-24 14:30:05" },
  { action: "settings.access", resource: "API Keys", user: "Alex Chen", status: "denied", timestamp: "2025-06-24 13:12:30" },
  { action: "agent.delete", resource: "Legacy Bot", user: "Mayank Sharma", status: "success", timestamp: "2025-06-24 12:00:00" },
  { action: "auth.login", resource: "User Session", user: "Legacy Bot", status: "denied", timestamp: "2025-06-23 19:30:00" },
]

export function registerGovernanceCommands(program: Command): void {
  const gov = program.command("governance").description("View governance and audit data")

  gov
    .command("audit")
    .description("View audit log")
    .action(() => {
      title(`Audit Log (${auditLog.length} events)`)
      for (const entry of auditLog) {
        const dot = entry.status === "success" ? chalk.green("●") : entry.status === "denied" ? chalk.red("●") : chalk.yellow("●")
        const statusColor = entry.status === "success" ? "green" : entry.status === "denied" ? "red" : "yellow"
        console.log(`  ${dot} ${chalk.cyan(entry.action)} ${chalk.dim("on")} ${chalk.white(entry.resource)}`)
        console.log(`    ${chalk.dim("by")} ${entry.user} ${chalk.dim("·")} ${badge(entry.status, statusColor as any)} ${chalk.dim("·")} ${entry.timestamp}`)
        console.log()
      }
    })

  gov
    .command("rbac")
    .description("Show RBAC matrix summary")
    .action(() => {
      title("RBAC Matrix")
      const roles = [
        { role: "Admin", users: 1, perms: "All permissions" },
        { role: "Developer", users: 2, perms: "Create/edit agents & pipelines" },
        { role: "Operator", users: 1, perms: "Edit agents & pipelines, no delete" },
        { role: "Viewer", users: 2, perms: "View only, audit access" },
      ]
      for (const r of roles) {
        const dot = r.role === "Admin" ? chalk.red("●") : r.role === "Developer" ? chalk.blue("●") : r.role === "Operator" ? chalk.yellow("●") : chalk.dim("●")
        console.log(`  ${dot} ${chalk.bold(r.role)} ${chalk.dim(`(${r.users} user${r.users > 1 ? "s" : ""})`)}`)
        console.log(`    ${chalk.dim(r.perms)}`)
        console.log()
      }
    })
}
