import { ContextEngine } from "@flowmind/context-engine"

let _contextEngine: ContextEngine | null = null

export function getContextEngine(): ContextEngine {
  if (!_contextEngine) _contextEngine = new ContextEngine()
  return _contextEngine
}
