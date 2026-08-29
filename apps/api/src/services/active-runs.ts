const activeRunControllers = new Map<string, AbortController>();

export function isRunActive(runId: string): boolean {
  return activeRunControllers.has(runId);
}

export function getActiveRunController(runId: string): AbortController | undefined {
  return activeRunControllers.get(runId);
}

export function registerActiveRun(runId: string, controller: AbortController): void {
  activeRunControllers.set(runId, controller);
}

export function unregisterActiveRun(runId: string): void {
  activeRunControllers.delete(runId);
}