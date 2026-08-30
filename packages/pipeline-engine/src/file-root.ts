import path from "node:path"

const DEFAULT_ROOT = path.join(process.cwd(), "pipeline-files")

export function configuredFileRoot(rootEnv: string | undefined = process.env.PIPELINE_FILE_ROOT): string {
  return rootEnv && rootEnv.trim() ? path.resolve(rootEnv.trim()) : DEFAULT_ROOT
}

export function resolveWithinRoot(root: string, requestedPath: string): string {
  if (!requestedPath) throw new Error("file path is required")
  if (path.isAbsolute(requestedPath)) throw new Error(`Absolute paths are not allowed; use a path relative to the configured file root (${root})`)
  const resolved = path.resolve(root, requestedPath)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes the configured file root (${root}): ${requestedPath}`)
  }
  return resolved
}

export function assertWithinRoot(root: string, absolutePath: string): void {
  const resolved = path.resolve(absolutePath)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes the configured file root (${root}): ${absolutePath}`)
  }
}
