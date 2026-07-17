import EventEmitter from "events"

const sessionEmitters = new Map<string, EventEmitter>()

export function getSessionEmitter(sessionId: string): EventEmitter {
  let emitter = sessionEmitters.get(sessionId)
  if (!emitter) {
    emitter = new EventEmitter()
    emitter.setMaxListeners(50)
    sessionEmitters.set(sessionId, emitter)
  }
  return emitter
}
