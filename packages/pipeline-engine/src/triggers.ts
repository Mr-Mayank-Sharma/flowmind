import type { TriggerHandler, TriggerEvent } from "./types"

type EventCallback = (event: TriggerEvent) => void

const activeTriggers = new Map<string, () => void>()

export function createTriggerDaemon(): {
  handlers: Map<string, TriggerHandler>
  registerHandler: (handler: TriggerHandler) => void
  startTrigger: (pipelineId: string, type: string, config: Record<string, unknown>, callback: EventCallback) => Promise<void>
  stopTrigger: (pipelineId: string) => void
  stopAll: () => void
} {
  const handlers = new Map<string, TriggerHandler>()

  handlers.set("manual", {
    type: "manual",
    async start(pipelineId, _config, onEvent) {
      onEvent({ id: `manual-${Date.now()}`, type: "manual", source: "user", payload: {}, timestamp: Date.now() })
      return () => {}
    },
  })

  handlers.set("webhook", {
    type: "webhook",
    async start(pipelineId, config, onEvent) {
      const path = (config.webhookUrl as string) ?? `/webhook/${pipelineId}`
      const listener = (event: CustomEvent) => {
        onEvent({ id: `webhook-${Date.now()}`, type: "webhook", source: path, payload: event.detail ?? {}, timestamp: Date.now() })
      }
      if (typeof window !== "undefined") {
        window.addEventListener("flowmind-webhook", listener as EventListener)
      }
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("flowmind-webhook", listener as EventListener)
        }
      }
    },
  })

  handlers.set("cron", {
    type: "cron",
    async start(pipelineId, config, onEvent) {
      const cronExpr = (config.cronExpression as string) ?? "*/5 * * * *"
      const parts = cronExpr.split(" ")
      const intervalMinutes = parseInt(parts[0] ?? "5") ?? 5
      const intervalMs = Math.max(intervalMinutes * 60 * 1000, 10000)
      const intervalId = setInterval(() => {
        onEvent({ id: `cron-${Date.now()}`, type: "cron", source: cronExpr, payload: { time: new Date().toISOString() }, timestamp: Date.now() })
      }, intervalMs)
      return () => clearInterval(intervalId)
    },
  })

  handlers.set("polling", {
    type: "polling",
    async start(pipelineId, config, onEvent) {
      const intervalMs = (config.intervalMs as number) ?? 60000
      const endpoint = (config.endpoint as string) ?? ""
      const intervalId = setInterval(async () => {
        let payload: unknown = { polled: true, time: new Date().toISOString() }
        if (endpoint) {
          try {
            const res = await fetch(endpoint)
            payload = await res.json()
          } catch (err) {
            payload = { error: String(err), time: new Date().toISOString() }
          }
        }
        onEvent({ id: `poll-${Date.now()}`, type: "polling", source: endpoint || "interval", payload, timestamp: Date.now() })
      }, intervalMs)
      return () => clearInterval(intervalId)
    },
  })

  return {
    handlers,

    registerHandler(handler: TriggerHandler) {
      handlers.set(handler.type, handler)
    },

    async startTrigger(pipelineId, type, config, callback) {
      const handler = handlers.get(type)
      if (!handler) throw new Error(`No trigger handler for type: ${type}`)
      const stop = await handler.start(pipelineId, config, callback)
      activeTriggers.set(pipelineId, stop)
    },

    stopTrigger(pipelineId) {
      const stop = activeTriggers.get(pipelineId)
      if (stop) {
        stop()
        activeTriggers.delete(pipelineId)
      }
    },

    stopAll() {
      for (const [id, stop] of activeTriggers) {
        stop()
        activeTriggers.delete(id)
      }
    },
  }
}
