import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { RuntimeRegistry, type RuntimeManifest } from "../index"

function makeManifest(overrides?: Partial<RuntimeManifest>): RuntimeManifest {
  return {
    name: "test-runtime",
    endpoint: "http://localhost:9999",
    description: "Test runtime",
    version: "1.0.0",
    capabilities: [],
    healthCheckPath: "/health",
    ...overrides,
  }
}

describe("RuntimeRegistry", () => {
  let registry: RuntimeRegistry

  beforeEach(() => {
    registry = new RuntimeRegistry()
  })

  afterEach(() => {
    registry.destroy()
  })

  describe("register", () => {
    it("registers a runtime and returns it with an id", () => {
      const manifest = makeManifest()
      const runtime = registry.register(manifest)
      expect(runtime.id).toMatch(/^rt-/)
      expect(runtime.manifest.name).toBe("test-runtime")
      expect(runtime.status).toBe("online")
    })

    it("updates existing runtime when registering same endpoint", () => {
      const manifest = makeManifest()
      const first = registry.register(manifest)
      const second = registry.register(makeManifest({ name: "updated" }))
      expect(first.id).toBe(second.id)
      expect(second.manifest.name).toBe("updated")
    })

    it("assigns unique ids to different endpoints", () => {
      const r1 = registry.register(makeManifest({ endpoint: "http://a:1" }))
      const r2 = registry.register(makeManifest({ endpoint: "http://b:2" }))
      expect(r1.id).not.toBe(r2.id)
    })
  })

  describe("unregister", () => {
    it("removes a runtime", () => {
      const runtime = registry.register(makeManifest())
      expect(registry.get(runtime.id)).toBeDefined()
      expect(registry.unregister(runtime.id)).toBe(true)
      expect(registry.get(runtime.id)).toBeUndefined()
    })

    it("returns false for non-existent id", () => {
      expect(registry.unregister("rt-nonexistent")).toBe(false)
    })
  })

  describe("list", () => {
    it("returns all registered runtimes", () => {
      registry.register(makeManifest({ endpoint: "http://a:1" }))
      registry.register(makeManifest({ endpoint: "http://b:2" }))
      expect(registry.list()).toHaveLength(2)
    })

    it("returns empty array when no runtimes", () => {
      expect(registry.list()).toHaveLength(0)
    })
  })

  describe("findByEndpoint", () => {
    it("finds runtime by endpoint", () => {
      const runtime = registry.register(makeManifest({ endpoint: "http://unique:123" }))
      expect(registry.findByEndpoint("http://unique:123")?.id).toBe(runtime.id)
    })

    it("returns undefined for unknown endpoint", () => {
      expect(registry.findByEndpoint("http://unknown:999")).toBeUndefined()
    })
  })

  describe("dispatch", () => {
    it("returns null when no runtimes registered", () => {
      expect(registry.dispatch({ nodeType: "aiAgent" })).toBeNull()
    })

    it("selects runtime with matching capability", () => {
      registry.register(makeManifest({
        endpoint: "http://a:1",
        capabilities: [{ name: "ai", supportedNodeTypes: ["aiAgent", "summarizer"] }],
      }))
      registry.register(makeManifest({
        endpoint: "http://b:2",
        capabilities: [{ name: "data", supportedNodeTypes: ["dataExtractor"] }],
      }))

      const result = registry.dispatch({ nodeType: "aiAgent" })
      expect(result).not.toBeNull()
      expect(result!.endpoint).toBe("http://a:1")
    })

    it("selects runtime with no capability restrictions as fallback", () => {
      registry.register(makeManifest({
        endpoint: "http://general:1",
        capabilities: [],
      }))

      const result = registry.dispatch({ nodeType: "anything" })
      expect(result).not.toBeNull()
      expect(result!.endpoint).toBe("http://general:1")
    })

    it("skips offline runtimes", () => {
      const runtime = registry.register(makeManifest({ endpoint: "http://a:1" }))
      registry.unregister(runtime.id)
      // Re-register as offline by manipulating status
      const r2 = registry.register(makeManifest({ endpoint: "http://a:1" }))
      ;(r2 as any).status = "offline"

      const general = registry.register(makeManifest({ endpoint: "http://b:2", capabilities: [] }))
      const result = registry.dispatch({ nodeType: "aiAgent" })
      expect(result!.endpoint).toBe("http://b:2")
    })

    it("prefers lower load runtime", () => {
      const r1 = registry.register(makeManifest({ endpoint: "http://a:1", capabilities: [] }))
      const r2 = registry.register(makeManifest({ endpoint: "http://b:2", capabilities: [] }))
      registry.updateLoad(r1.id, 10)
      registry.updateLoad(r2.id, 2)

      const result = registry.dispatch({ nodeType: "aiAgent" })
      expect(result!.endpoint).toBe("http://b:2")
    })
  })

  describe("updateLoad", () => {
    it("updates runtime load", () => {
      const runtime = registry.register(makeManifest())
      registry.updateLoad(runtime.id, 42)
      expect(registry.get(runtime.id)!.currentLoad).toBe(42)
    })
  })

  describe("destroy", () => {
    it("clears all runtimes", () => {
      registry.register(makeManifest({ endpoint: "http://a:1" }))
      registry.register(makeManifest({ endpoint: "http://b:2" }))
      registry.destroy()
      expect(registry.list()).toHaveLength(0)
    })
  })
})
