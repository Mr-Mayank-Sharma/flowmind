import EventEmitter from "events"

const MAX_BUFFER = 1000

export interface BufferedEvent {
  event: string
  data: unknown
}

export class BufferedEmitter extends EventEmitter {
  readonly buffer: BufferedEvent[] = []

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

const sessionEmitters = new Map<string, BufferedEmitter>()

export function getSessionEmitter(sessionId: string): BufferedEmitter {
  let emitter = sessionEmitters.get(sessionId)
  if (!emitter) {
    emitter = new BufferedEmitter()
    emitter.setMaxListeners(50)
    sessionEmitters.set(sessionId, emitter)
  }
  return emitter
}

export function cleanupSessionEmitter(sessionId: string): void {
  const emitter = sessionEmitters.get(sessionId)
  if (emitter) {
    emitter.removeAllListeners()
    sessionEmitters.delete(sessionId)
  }
}
