import type { ToolDef, ToolInfo } from "./types"

interface RegistryState {
  builtin: ToolDef[]
  custom: ToolDef[]
}

export class ToolRegistry {
  private state: RegistryState = { builtin: [], custom: [] }

  register(info: ToolInfo): void {
    this.state.builtin.push(info.init())
  }

  registerCustom(def: ToolDef): void {
    this.state.custom.push(def)
  }

  all(): ToolDef[] {
    return [...this.state.builtin, ...this.state.custom]
  }

  ids(): string[] {
    return this.all().map((t) => t.id)
  }

  get(id: string): ToolDef | undefined {
    return this.all().find((t) => t.id === id)
  }
}

export const toolRegistry = new ToolRegistry()
