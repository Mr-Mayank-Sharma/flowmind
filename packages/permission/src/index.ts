import { minimatch } from "minimatch"
import { createId } from "./id"

export type Action = "allow" | "deny" | "ask"

export interface Rule {
  permission: string
  pattern: string
  action: Action
}

export type Ruleset = Rule[]

export interface Request {
  id: string
  sessionId: string
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: { messageId: string; callId: string }
}

export interface AskInput {
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  sessionId: string
  ruleset: Ruleset
  id?: string
  tool?: { messageId: string; callId: string }
}

export interface ReplyInput {
  requestId: string
  reply: "once" | "always" | "reject"
  message?: string
}

export type Reply = "once" | "always" | "reject"

export class PermissionDeniedError extends Error {
  constructor(public ruleset: Ruleset) {
    super("Permission denied")
    this.name = "PermissionDeniedError"
  }
}

export class PermissionRejectedError extends Error {
  constructor() {
    super("Permission rejected")
    this.name = "PermissionRejectedError"
  }
}

export class PermissionCorrectedError extends Error {
  constructor(public feedback: string) {
    super(`Permission corrected: ${feedback}`)
    this.name = "PermissionCorrectedError"
  }
}

export type PermissionError = PermissionDeniedError | PermissionRejectedError | PermissionCorrectedError

export namespace Permission {
  export type Request = import("./index").Request
  export type AskInput = import("./index").AskInput
  export type ReplyInput = import("./index").ReplyInput
  export type Reply = import("./index").Reply
  export type Rule = import("./index").Rule
  export type Ruleset = import("./index").Ruleset
}

export function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): Rule {
  for (let i = rulesets.length - 1; i >= 0; i--) {
    const rs = rulesets[i]
    if (!rs) continue
    for (let j = rs.length - 1; j >= 0; j--) {
      const rule = rs[j]
      if (!rule) continue
      if (minimatch(permission, rule.permission) && minimatch(pattern, rule.pattern)) {
        return rule
      }
    }
  }
  return { action: "ask", permission, pattern: "*" }
}

export function fromConfig(config: Record<string, string | Record<string, string>>): Ruleset {
  const ruleset: Rule[] = []
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      ruleset.push({ permission: key, action: value as Action, pattern: "*" })
    } else {
      for (const [pattern, action] of Object.entries(value)) {
        ruleset.push({ permission: key, pattern: expand(pattern), action: action as Action })
      }
    }
  }
  return ruleset
}

export function merge(...rulesets: Ruleset[]): Rule[] {
  return rulesets.flat()
}

export function disabled(tools: string[], ruleset: Ruleset): Set<string> {
  const edits = ["edit", "write", "apply_patch"]
  const reads = ["list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"]
  return new Set(
    tools.filter((tool) => {
      const perm = edits.includes(tool) ? "edit" : reads.includes(tool) ? "read" : tool
      const rule = ruleset.slice().reverse().find((r) => minimatch(perm, r.permission))
      return rule?.pattern === "*" && rule.action === "deny"
    })
  )
}

function expand(pattern: string): string {
  if (pattern.startsWith("~/")) return process.env.HOME + pattern.slice(1)
  if (pattern === "~") return process.env.HOME ?? "/root"
  return pattern
}
