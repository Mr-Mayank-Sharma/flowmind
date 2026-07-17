import EventEmitter from "events"

const runEmitters = new Map<string, EventEmitter>()

export function getRunEmitter(runId: string): EventEmitter {
  let emitter = runEmitters.get(runId)
  if (!emitter) {
    emitter = new EventEmitter()
    emitter.setMaxListeners(50)
    runEmitters.set(runId, emitter)
  }
  return emitter
}

export function cleanupRunEmitter(runId: string): void {
  const emitter = runEmitters.get(runId)
  if (emitter) {
    emitter.removeAllListeners()
    runEmitters.delete(runId)
  }
}
