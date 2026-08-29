import EventEmitter from "events"

const MAX_BUFFER = 1000

export interface BufferedEvent {
  event: string
  data: unknown
}

export class BufferedEmitter extends EventEmitter {
  readonly buffer: BufferedEvent[] = []

  constructor() {
    super()
    this.on("error", () => {})
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    if (typeof event === "string") {
      this.buffer.push({ event, data: args[0] })
      if (this.buffer.length > MAX_BUFFER) this.buffer.shift()
    }
    return super.emit(event, ...args)
  }

  clearBuffer(): void {
    this.buffer.length = 0
  }
}

const runEmitters = new Map<string, BufferedEmitter>()

export function getRunEmitter(runId: string): BufferedEmitter {
  let emitter = runEmitters.get(runId)
  if (!emitter) {
    emitter = new BufferedEmitter()
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
