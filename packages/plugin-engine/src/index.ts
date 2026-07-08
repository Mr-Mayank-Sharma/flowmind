import fs from "fs"
import path from "path"

export interface PluginTool {
  args: Record<string, unknown>
  description: string
  execute: (args: any, ctx: any) => Promise<string | { title?: string; output: string; metadata?: Record<string, unknown>; attachments?: any[] }>
}

export interface PluginModule {
  name: string
  description?: string
  tool?: Record<string, PluginTool>
  hooks?: Record<string, (input: any) => any | Promise<any>>
  mcp?: Record<string, { command: string[]; env?: Record<string, string> }>
}

type HookHandler = (input: any) => any | Promise<any>

export class PluginEngine {
  private plugins: Map<string, PluginModule> = new Map()
  private hookHandlers: Map<string, HookHandler[]> = new Map()
  private loadedPaths: Set<string> = new Set()

  async loadFromDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js") && !file.endsWith(".ts")) continue
      const fullPath = path.join(dir, file)
      if (this.loadedPaths.has(fullPath)) continue

      try {
        const mod = await import(pathToFileURL(fullPath).toString())
        this.registerModule(mod.default ?? mod)
        this.loadedPaths.add(fullPath)
      } catch (e) {
        console.error(`Failed to load plugin ${file}:`, e)
      }
    }
  }

  registerModule(mod: PluginModule): void {
    if (!mod.name) return
    this.plugins.set(mod.name, mod)

    if (mod.tool) {
      for (const [id, tool] of Object.entries(mod.tool)) {
        this.emit("tool.created", { plugin: mod.name, id, tool })
      }
    }

    if (mod.hooks) {
      for (const [hook, handler] of Object.entries(mod.hooks)) {
        this.on(hook, handler)
      }
    }
  }

  on(event: string, handler: HookHandler): void {
    if (!this.hookHandlers.has(event)) {
      this.hookHandlers.set(event, [])
    }
    this.hookHandlers.get(event)!.push(handler)
  }

  async emit(event: string, input: any): Promise<any[]> {
    const handlers = this.hookHandlers.get(event) ?? []
    const results: any[] = []
    for (const handler of handlers) {
      try {
        const result = await handler(input)
        if (result !== undefined) results.push(result)
      } catch (e) {
        console.error(`Plugin hook ${event} error:`, e)
      }
    }
    return results
  }

  getPlugins(): PluginModule[] {
    return Array.from(this.plugins.values())
  }

  getTools(): Array<{ plugin: string; id: string; tool: PluginTool }> {
    const tools: Array<{ plugin: string; id: string; tool: PluginTool }> = []
    for (const [name, mod] of this.plugins) {
      if (mod.tool) {
        for (const [id, tool] of Object.entries(mod.tool)) {
          tools.push({ plugin: name, id, tool })
        }
      }
    }
    return tools
  }
}

function pathToFileURL(filePath: string): string {
  const absPath = path.resolve(filePath)
  if (process.platform === "win32") {
    return "file:///" + absPath.replace(/\\/g, "/")
  }
  return "file://" + absPath
}

export const pluginEngine = new PluginEngine()
