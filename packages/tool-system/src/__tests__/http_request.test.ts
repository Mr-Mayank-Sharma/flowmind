import { describe, it, expect, vi } from "vitest"
import { createHttpRequestTool } from "../tools/http_request"
import type { ToolContext } from "../types"

function makeCtx(): ToolContext {
  return {
    sessionId: "s",
    messageId: "m",
    agent: "test",
    async ask() {},
    metadata() {},
  }
}

const tool = createHttpRequestTool().init()

describe("http_request tool (B1)", () => {
  it("is registered with the expected id and methods", () => {
    expect(tool.id).toBe("http_request")
    expect(tool.description).toContain("HTTP")
  })

  it("refuses a loopback URL (SSRF guard)", async () => {
    await expect(
      tool.execute({ url: "http://127.0.0.1:3001/health", method: "GET" }, makeCtx()),
    ).rejects.toThrow(/Refused|blocked/i)
  })

  it("refuses a private-network URL (SSRF guard)", async () => {
    await expect(
      tool.execute({ url: "http://192.168.1.10/foo", method: "GET" }, makeCtx()),
    ).rejects.toThrow(/Refused|blocked/i)
  })

  it("rejects a GET request with a body", async () => {
    await expect(
      tool.execute({ url: "https://example.com", method: "GET", body: { a: 1 } }, makeCtx()),
    ).rejects.toThrow(/body/i)
  })
})
