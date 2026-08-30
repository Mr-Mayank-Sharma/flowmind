import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { SMTPServer } from "smtp-server"
import net from "node:net"
import { executeNode } from "../runners"
import type { PipelineNode, ExecutionContext } from "../types"

interface CapturedMessage {
  to: string
  subject: string
  body: string
}

function makeContext(): ExecutionContext {
  return {
    runId: "test-run",
    pipelineId: "test-pipeline",
    graph: { nodes: [], edges: [] },
    input: {},
    outputs: new Map(),
    variables: {},
    staticData: {},
    nodeStaticData: new Map(),
    binaryData: new Map(),
    abortSignal: new AbortController().signal,
  }
}

describe("sendEmail node (local SMTP capture)", () => {
  let server: SMTPServer
  let port: number
  let captured: CapturedMessage[] = []

  async function listen(): Promise<number> {
    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = (server.server as net.Server).address() as net.AddressInfo
        resolve(addr.port)
      })
    })
  }

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["AUTH", "STARTTLS"],
      onData(stream, session, callback) {
        let raw = ""
        stream.on("data", (chunk) => {
          raw += chunk.toString("utf-8")
        })
        stream.on("end", () => {
          const to = (session.envelope.rcptTo?.[0]?.address) ?? ""
          const subjectMatch = raw.match(/^Subject: (.+)$/mi)
          captured.push({ to, subject: subjectMatch?.[1] ?? "", body: raw })
          callback()
        })
      },
    })
    port = await listen()
    process.env.SMTP_HOST = "127.0.0.1"
    process.env.SMTP_PORT = String(port)
    process.env.SMTP_USER = "testuser"
    process.env.SMTP_PASS = "testpass"
    process.env.SMTP_FROM = "sender@flowmind.test"
  }, 15_000)

  afterAll(async () => {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_FROM
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it("sends an email that is captured locally", async () => {
    const node: PipelineNode = {
      id: "n1",
      type: "sendEmail",
      label: "Email",
      position: { x: 0, y: 0 },
      config: { to: "recipient@flowmind.test", subject: "Hello from FlowMind", body: "This is a test body." },
    }
    const result = await executeNode(node, makeContext())
    const out = result.output as any
    expect(out.sent).toBe(true)
    expect(out.error).toBeFalsy()
    expect(captured.length).toBeGreaterThan(0)
    const msg = captured[0]!
    expect(msg.to).toBe("recipient@flowmind.test")
    expect(msg.subject).toBe("Hello from FlowMind")
    expect(msg.body).toContain("This is a test body.")
  }, 15_000)
})
