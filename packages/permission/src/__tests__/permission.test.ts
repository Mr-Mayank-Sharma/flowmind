import { describe, it, expect } from "vitest"
import { evaluate, fromConfig, merge, disabled, PermissionDeniedError, PermissionRejectedError, PermissionCorrectedError, type Ruleset } from "../index"

describe("permission evaluate", () => {
  it("returns ask when no rulesets match", () => {
    const rule = evaluate("edit", "src/file.ts")
    expect(rule.action).toBe("ask")
    expect(rule.permission).toBe("edit")
  })

  it("matches an allow rule", () => {
    const ruleset: Ruleset = [{ permission: "edit", pattern: "src/**", action: "allow" }]
    const rule = evaluate("edit", "src/file.ts", ruleset)
    expect(rule.action).toBe("allow")
  })

  it("matches a deny rule", () => {
    const ruleset: Ruleset = [{ permission: "edit", pattern: "*.env", action: "deny" }]
    const rule = evaluate("edit", "config.env", ruleset)
    expect(rule.action).toBe("deny")
  })

  it("last ruleset wins when overlapping", () => {
    const rs1: Ruleset = [{ permission: "edit", pattern: "**", action: "allow" }]
    const rs2: Ruleset = [{ permission: "edit", pattern: "*.env", action: "deny" }]
    const rule = evaluate("edit", "config.env", rs1, rs2)
    expect(rule.action).toBe("deny")
  })

  it("last rule in ruleset wins", () => {
    const ruleset: Ruleset = [
      { permission: "edit", pattern: "**", action: "allow" },
      { permission: "edit", pattern: "secret/**", action: "deny" },
    ]
    const rule = evaluate("edit", "secret/key.ts", ruleset)
    expect(rule.action).toBe("deny")
  })

  it("uses glob patterns", () => {
    const ruleset: Ruleset = [{ permission: "read", pattern: "docs/**/*.md", action: "allow" }]
    expect(evaluate("read", "docs/guide/intro.md", ruleset).action).toBe("allow")
    expect(evaluate("read", "src/index.ts", ruleset).action).toBe("ask")
  })
})

describe("permission fromConfig", () => {
  it("converts flat config to ruleset", () => {
    const config = { edit: "allow", read: "deny" }
    const ruleset = fromConfig(config)
    expect(ruleset).toHaveLength(2)
    expect(ruleset[0]).toEqual({ permission: "edit", action: "allow", pattern: "*" })
    expect(ruleset[1]).toEqual({ permission: "read", action: "deny", pattern: "*" })
  })

  it("converts nested config to ruleset", () => {
    const config = {
      edit: { "src/**": "allow", "*.env": "deny" },
    }
    const ruleset = fromConfig(config)
    expect(ruleset).toHaveLength(2)
    expect(ruleset[0]!.action).toBe("allow")
    expect(ruleset[1]!.action).toBe("deny")
  })
})

describe("permission merge", () => {
  it("flattens multiple rulesets", () => {
    const rs1: Ruleset = [{ permission: "edit", pattern: "**", action: "allow" }]
    const rs2: Ruleset = [{ permission: "read", pattern: "**", action: "deny" }]
    const merged = merge(rs1, rs2)
    expect(merged).toHaveLength(2)
  })
})

describe("permission disabled", () => {
  it("returns disabled tools denied with pattern *", () => {
    const ruleset: Ruleset = [
      { permission: "edit", pattern: "*", action: "deny" },
      { permission: "read", pattern: "*", action: "allow" },
    ]
    const disabledTools = disabled(["edit", "write", "apply_patch", "read"], ruleset)
    expect(disabledTools.has("edit")).toBe(true)
    expect(disabledTools.has("write")).toBe(true)
    expect(disabledTools.has("apply_patch")).toBe(true)
    expect(disabledTools.has("read")).toBe(false)
  })

  it("returns empty set when nothing is denied", () => {
    const ruleset: Ruleset = [{ permission: "edit", pattern: "*", action: "allow" }]
    const disabledTools = disabled(["edit", "write"], ruleset)
    expect(disabledTools.size).toBe(0)
  })
})

describe("permission errors", () => {
  it("PermissionDeniedError has correct name", () => {
    const err = new PermissionDeniedError([])
    expect(err.name).toBe("PermissionDeniedError")
    expect(err.message).toBe("Permission denied")
  })

  it("PermissionRejectedError has correct name", () => {
    const err = new PermissionRejectedError()
    expect(err.name).toBe("PermissionRejectedError")
  })

  it("PermissionCorrectedError includes feedback", () => {
    const err = new PermissionCorrectedError("use /tmp instead")
    expect(err.feedback).toBe("use /tmp instead")
    expect(err.message).toContain("corrected")
  })
})
