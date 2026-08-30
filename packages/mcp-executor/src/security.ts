import path from "node:path"
import { assertPublicHttpUrl, BlockedUrlError } from "./network-guard"

export class McpSecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McpSecurityError"
  }
}

/**
 * Characters that make a stdio command unsafe to treat as a single executable:
 * whitespace, shell separators/globs, variable expansion, quoting, and cmd.exe
 * interpolation. Backslashes remain legal because Windows absolute paths use them.
 */
const COMMAND_METACHARACTERS = /[\s;&|<>$()'"`%*?\[\]{}#!~]/

/** Parse the MCP_ALLOWED_COMMANDS env allowlist into a set of executables. */
export function getAllowedCommands(): Set<string> {
  const raw = process.env.MCP_ALLOWED_COMMANDS ?? ""
  return new Set(raw.split(",").map((entry) => entry.trim()).filter(Boolean))
}

function normalizeCommand(command: string): string {
  const normalized = command.replace(/\\/g, "/")
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

export function isAllowedCommand(command: string, allowed: Set<string>): boolean {
  const normalized = normalizeCommand(command)
  const hasSeparator = command.includes("/") || (process.platform === "win32" && command.includes("\\"))

  for (const rawEntry of allowed) {
    const entry = rawEntry.trim()
    if (!entry) continue

    if (hasSeparator) {
      // Paths (absolute or relative) must be allowlisted exactly.
      if (normalizeCommand(entry) === normalized) return true
      continue
    }

    // Bare names match an allowlist entry by name, or by the basename of a
    // allowlisted full path (e.g. MCP_ALLOWED_COMMANDS=/usr/bin/node + command "node").
    const entryNormalized = normalizeCommand(entry)
    if (entryNormalized === normalized) return true
    if (entryNormalized === normalizeCommand(path.basename(command))) return true
    if (entry.includes("/") || (process.platform === "win32" && entry.includes("\\"))) {
      if (normalizeCommand(path.basename(entry)) === normalized) return true
    }
  }
  return false
}

/**
 * Gate stdio server launches. Spawning arbitrary remote processes is dangerous, so
 * a command is only accepted when it is a single path/name explicitly listed in
 * MCP_ALLOWED_COMMANDS. Without that env allowlist, stdio is refused outright.
 */
export function assertCommandAllowed(command: string): void {
  const trimmed = command.trim()
  if (!trimmed) {
    throw new McpSecurityError("MCP stdio command must not be empty")
  }
  if (COMMAND_METACHARACTERS.test(trimmed)) {
    throw new McpSecurityError(
      `MCP stdio command must be a single executable path (no shell metacharacters): '${trimmed}'`,
    )
  }

  const allowed = getAllowedCommands()
  if (allowed.size === 0) {
    throw new McpSecurityError(
      "MCP stdio transport is disabled: set MCP_ALLOWED_COMMANDS to an explicit allowlist of executables",
    )
  }
  if (!isAllowedCommand(trimmed, allowed)) {
    throw new McpSecurityError(`MCP stdio command '${trimmed}' is not in MCP_ALLOWED_COMMANDS`)
  }
}

/**
 * Gate remote MCP base URLs. Only public http(s) URLs are allowed; private,
 * loopback, and link-local ranges are blocked unless ALLOW_PRIVATE_MCP_URLS=true
 * (explicit dev flag). Non-http schemes such as file:// are always refused.
 */
export async function assertMcpRemoteUrl(rawUrl: string): Promise<URL> {
  if (rawUrl.trim().toLowerCase().startsWith("file:")) {
    throw new McpSecurityError("MCP remote baseUrl must be http(s), got a file: URL")
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_MCP_URLS === "true"
  try {
    return await assertPublicHttpUrl(rawUrl, allowPrivate)
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      throw new McpSecurityError(err.message)
    }
    throw err
  }
}