import ivm from "isolated-vm"

export interface CodeSandboxResult {
  output: unknown
  console: string[]
}

export interface CodeSandboxOptions {
  timeoutMs?: number
  memoryMb?: number
}

const DEFAULT_TIMEOUT_MS = 3000
const DEFAULT_MEMORY_MB = 64

// The sandbox exposes a deliberately minimal view of the process environment so no
// credentials or secrets leak through the returned result. Only public, non-secret
// deployment knobs are allowed.
const SANDBOX_SAFE_ENV = new Set(["NODE_ENV", "APP_NAME"])

export function sanitizeEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of SANDBOX_SAFE_ENV) {
    const value = env[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * Execute user-supplied JavaScript inside an isolated V8 isolate. The isolate has no
 * access to the host network, filesystem, process, or any module loader. Only the
 * supplied plain-data `globals` are injected; the JS standard library (Math, JSON,
 * Array, Object, ...) is provided natively by the isolate itself.
 *
 * Execution is synchronous. A hard timeout aborts runaway code; a memory limit bounds
 * allocation. The code runs as a function body and its return value is JSON-serialized.
 * Results are copied back to the host, never passed by reference.
 */
export async function runCodeSandboxed(code: string, globals: Record<string, unknown>, options: CodeSandboxOptions = {}): Promise<CodeSandboxResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const memoryMb = options.memoryMb ?? DEFAULT_MEMORY_MB

  const isolate = new ivm.Isolate({ memoryLimit: memoryMb })
  const context = isolate.createContextSync()
  const jail = context.global

  const consoleLines: string[] = []
  jail.setSync(
    "__sandboxConsole",
    new ivm.Reference({
      log: (...args: unknown[]) => consoleLines.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => consoleLines.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => consoleLines.push(args.map(String).join(" ")),
    }),
  )
  jail.setSync("console", jail.getSync("__sandboxConsole"))

  for (const [key, raw] of Object.entries(globals)) {
    let value: unknown = raw
    try {
      value = JSON.parse(JSON.stringify(raw))
    } catch {
      value = null
    }
    jail.setSync(key, new ivm.ExternalCopy(value).copyInto())
  }

  try {
    const script = isolate.compileScriptSync(
      `(function(){\n const fm__result = (function(){\n${code}\n})();\n return JSON.stringify(fm__result === undefined ? null : fm__result);\n})()`,
      { filename: "pipeline-code-execute.js" },
    )
    const raw = await script.run(context, { timeout: timeoutMs, promise: true, result: { copy: true, promise: true } })

    let output: unknown = null
    if (typeof raw === "string") {
      try {
        output = JSON.parse(raw)
      } catch {
        output = raw
      }
    } else if (raw !== null && raw !== undefined) {
      output = raw
    }

    context.release()
    isolate.dispose()
    return { output, console: consoleLines }
  } catch (err) {
    try {
      context.release()
    } catch {
      /* ignore double-release */
    }
    isolate.dispose()
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Code execution failed: ${message}`)
  }
}
