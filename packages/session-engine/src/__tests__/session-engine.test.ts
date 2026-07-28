import { describe, it, expect, beforeEach } from "vitest"
import { SessionEngine } from "../index"

describe("SessionEngine", () => {
  let engine: SessionEngine

  beforeEach(() => {
    engine = new SessionEngine({ maxTokens: 1000, preserveRecentTokens: 200 })
  })

  describe("addMessage", () => {
    it("adds a message with id and timestamp", () => {
      const msg = engine.addMessage({ role: "user", content: "hello" })
      expect(msg.id).toMatch(/^msg_/)
      expect(msg.timestamp).toBeGreaterThan(0)
      expect(msg.content).toBe("hello")
      expect(msg.role).toBe("user")
    })

    it("assigns incrementing ids", () => {
      const m1 = engine.addMessage({ role: "user", content: "a" })
      const m2 = engine.addMessage({ role: "assistant", content: "b" })
      expect(m1.id).not.toBe(m2.id)
    })
  })

  describe("getMessages", () => {
    it("returns a copy of messages", () => {
      engine.addMessage({ role: "user", content: "test" })
      const msgs = engine.getMessages()
      expect(msgs).toHaveLength(1)
      msgs.pop()
      expect(engine.getMessages()).toHaveLength(1)
    })
  })

  describe("estimateTokens", () => {
    it("returns 0 for empty session", () => {
      expect(engine.estimateTokens()).toBe(0)
    })

    it("estimates tokens based on content length / 4", () => {
      engine.addMessage({ role: "user", content: "a".repeat(400) })
      expect(engine.estimateTokens()).toBe(100)
    })

    it("includes tool call content in estimation", () => {
      engine.addMessage({
        role: "assistant",
        content: "test",
        toolCalls: [{ name: "bash", args: { command: "ls" } }],
      })
      const tokens = engine.estimateTokens()
      expect(tokens).toBeGreaterThan(1)
    })
  })

  describe("compact", () => {
    it("returns pruned 0 when under token limit", async () => {
      engine.addMessage({ role: "user", content: "short" })
      const result = await engine.compact()
      expect(result.pruned).toBe(0)
    })

    it("prunes old messages when over token limit", async () => {
      for (let i = 0; i < 30; i++) {
        engine.addMessage({ role: "user", content: "x".repeat(200) })
      }
      const result = await engine.compact()
      expect(result.pruned).toBeGreaterThan(0)
      expect(result.summary).toBeTruthy()
    })

    it("preserves recent messages", async () => {
      for (let i = 0; i < 30; i++) {
        engine.addMessage({ role: "user", content: "x".repeat(200) })
      }
      await engine.compact()
      const msgs = engine.getMessages()
      expect(msgs.length).toBeGreaterThan(0)
      expect(msgs[0]!.role).toBe("system")
    })
  })

  describe("getSummary", () => {
    it("returns null initially", () => {
      expect(engine.getSummary()).toBeNull()
    })
  })

  describe("clear", () => {
    it("resets all state", () => {
      engine.addMessage({ role: "user", content: "test" })
      engine.clear()
      expect(engine.getMessages()).toHaveLength(0)
      expect(engine.getSummary()).toBeNull()
    })
  })
})
