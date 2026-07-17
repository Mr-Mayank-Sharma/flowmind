import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenHumanAdapter, type OpenHumanConfig } from "../adapters/openhuman"

function makeConfig(overrides?: Partial<OpenHumanConfig>): OpenHumanConfig {
  return { apiKey: "test-api-key", baseUrl: "https://api.test.com/v1", ...overrides }
}

describe("OpenHumanAdapter", () => {
  let adapter: OpenHumanAdapter
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new OpenHumanAdapter(makeConfig())
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "msg-1" }), text: () => Promise.resolve("") })
    vi.stubGlobal("fetch", fetchSpy)
  })

  describe("channelType", () => {
    it("returns 'openhuman'", () => {
      expect(adapter.channelType).toBe("openhuman")
    })
  })

  describe("sendMessage", () => {
    it("sends text message to OpenHuman API", async () => {
      await adapter.sendMessage({
        channelId: "conv-123",
        userId: "user-1",
        text: "Hello from FlowMind",
      })

      expect(fetchSpy).toHaveBeenCalled()
      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe("https://api.test.com/v1/messages")
      expect(opts.method).toBe("POST")
      expect(opts.headers).toMatchObject({ Authorization: "Bearer test-api-key" })
      const body = JSON.parse(opts.body)
      expect(body.conversation_id).toBe("conv-123")
      expect(body.user_id).toBe("user-1")
      expect(body.message).toBe("Hello from FlowMind")
    })

    it("includes attachments when files are provided", async () => {
      await adapter.sendMessage({
        channelId: "conv-1",
        text: "Here's a file",
        files: [{ url: "https://example.com/doc.pdf", mimeType: "application/pdf", name: "doc.pdf" }],
      })

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
      expect(body.attachments).toEqual([
        { url: "https://example.com/doc.pdf", type: "application/pdf", name: "doc.pdf" },
      ])
    })

    it("includes reply_to when replying", async () => {
      await adapter.sendMessage({
        channelId: "conv-1",
        text: "Reply",
        replyTo: "msg-42",
      })

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
      expect(body.reply_to).toBe("msg-42")
    })

    it("sends voice URL", async () => {
      await adapter.sendMessage({
        channelId: "conv-1",
        voiceUrl: "https://example.com/audio.mp3",
      })

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
      expect(body.voice_url).toBe("https://example.com/audio.mp3")
      expect(body.message).toBeUndefined()
    })

    it("throws on API error", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("Server error") })
      await expect(
        adapter.sendMessage({ channelId: "conv-1", text: "test" })
      ).rejects.toThrow("OpenHuman API error 500")
    })
  })

  describe("handleUpdate", () => {
    it("parses message events", async () => {
      const result = await adapter.handleUpdate({
        type: "message",
        data: {
          id: "msg-abc",
          conversation_id: "conv-1",
          user_id: "user-42",
          text: "Hello there",
        },
      })

      expect(result).not.toBeNull()
      expect(result!.id).toBe("msg-abc")
      expect(result!.channelType).toBe("openhuman")
      expect(result!.channelId).toBe("conv-1")
      expect(result!.userId).toBe("user-42")
      expect(result!.text).toBe("Hello there")
    })

    it("returns null for unrecognized event types", async () => {
      const result = await adapter.handleUpdate({ type: "unknown_event" })
      expect(result).toBeNull()
    })

    it("parses attachments", async () => {
      const result = await adapter.handleUpdate({
        type: "message",
        data: {
          id: "msg-1",
          conversation_id: "conv-1",
          user_id: "user-1",
          text: "Check this",
          attachments: [{ url: "https://example.com/img.png", type: "image/png", name: "img.png" }],
        },
      })

      expect(result!.files).toEqual([
        { url: "https://example.com/img.png", mimeType: "image/png", name: "img.png" },
      ])
    })

    it("parses voice messages", async () => {
      const result = await adapter.handleUpdate({
        type: "message",
        data: {
          id: "msg-1",
          conversation_id: "conv-1",
          user_id: "user-1",
          voice_url: "https://example.com/voice.mp3",
        },
      })

      expect(result!.voiceUrl).toBe("https://example.com/voice.mp3")
    })
  })

  describe("setupWebhook", () => {
    it("registers webhook URL", async () => {
      await adapter.setupWebhook("https://flowmind.example.com/webhook/openhuman")

      expect(fetchSpy).toHaveBeenCalled()
      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe("https://api.test.com/v1/webhooks")
      expect(opts.method).toBe("POST")
      const body = JSON.parse(opts.body)
      expect(body.url).toBe("https://flowmind.example.com/webhook/openhuman")
      expect(body.events).toEqual(["message", "conversation.created"])
    })
  })

  describe("defaults", () => {
    it("uses default base URL when not specified", () => {
      const defaultAdapter = new OpenHumanAdapter({ apiKey: "key" })
      expect((defaultAdapter as any).baseUrl).toBe("https://api.openhuman.ai/v1")
    })
  })
})
