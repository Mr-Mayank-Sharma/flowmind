import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { TRPCError } from "@trpc/server"

const AGENT = {
  id: "agent-1",
  userId: "user-1",
  name: "Research bot",
  description: null,
  model: "mistral:7b",
  status: "STOPPED" as "RUNNING" | "STOPPED" | "ERROR",
  tools: 0,
  temperature: 0.3,
  maxTokens: 2048,
  memory: "0.5 GB",
  messages: 0,
  successRate: 100,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

type AgentRow = typeof AGENT

// The tier/rate-limit middleware in protectedProcedure reads the module-level
// prisma client, so the mock has to cover those lookups too, not just agent.
const mocks = vi.hoisted(() => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    orgSubscription: { findUnique: vi.fn() },
    session: { count: vi.fn() },
    pipeline: { count: vi.fn() },
  },
}))

vi.mock("@flowmind/db", () => ({ prisma: mocks.prisma }))

function seedAgent(agent: AgentRow) {
  mocks.prisma.agent.findMany.mockResolvedValue([agent])
  mocks.prisma.agent.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => (where.id === agent.id ? agent : null)
  )
  mocks.prisma.agent.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...agent, ...data })
  )
  mocks.prisma.agent.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ ...agent, ...data })
  )
  mocks.prisma.agent.deleteMany.mockResolvedValue({ count: 1 })
  return mocks.prisma.agent
}

async function loadRouter(agent: AgentRow = AGENT) {
  vi.resetModules()
  seedAgent(agent)
  mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-1", tier: "FREE", orgId: null, role: "USER" })
  mocks.prisma.orgSubscription.findUnique.mockResolvedValue(null)
  mocks.prisma.session.count.mockResolvedValue(0)
  mocks.prisma.pipeline.count.mockResolvedValue(0)

  const { agentsRouter } = await import("../routers/agents")
  return {
    caller: agentsRouter.createCaller({
      prisma: mocks.prisma,
      userId: "user-1",
      hostClient: null,
      req: { method: "POST", headers: {} },
      res: {},
    } as never),
    agent: mocks.prisma.agent,
  }
}

const fetchMock = vi.fn()

describe("agents router — honest lifecycle", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("creates agents as STOPPED because nothing is deployed at creation time", async () => {
    const { caller, agent } = await loadRouter()

    const created = await caller.create({ name: "Research bot" })

    expect(created.status).toBe("STOPPED")
    expect(agent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "STOPPED", userId: "user-1" }) })
    )
    expect(JSON.stringify(agent.create.mock.calls)).not.toContain("DEPLOYING")
  })

  it("marks an agent RUNNING only when the runtime answers the health probe", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }))
    const { caller } = await loadRouter()

    const result = await caller.toggle({ id: AGENT.id })

    expect(result.status).toBe("RUNNING")
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/health",
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it("marks an agent ERROR when the runtime is unreachable instead of faking success", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
    const { caller } = await loadRouter()

    const result = await caller.toggle({ id: AGENT.id })

    expect(result.status).toBe("ERROR")
  })

  it("marks an agent ERROR when the runtime health endpoint returns a non-ok status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 503 }))
    const { caller } = await loadRouter()

    const result = await caller.toggle({ id: AGENT.id })

    expect(result.status).toBe("ERROR")
  })

  it("stops a running agent without probing the runtime", async () => {
    const { caller } = await loadRouter({ ...AGENT, status: "RUNNING" })

    const result = await caller.toggle({ id: AGENT.id })

    expect(result.status).toBe("STOPPED")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects toggling an agent owned by another user", async () => {
    const { caller } = await loadRouter({ ...AGENT, userId: "someone-else" })

    await expect(caller.toggle({ id: AGENT.id })).rejects.toBeInstanceOf(TRPCError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("health reports live runtime reachability plus a status breakdown", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }))
    const { caller, agent } = await loadRouter({ ...AGENT, status: "RUNNING" })
    agent.findMany.mockResolvedValue([
      { id: "a", status: "RUNNING" },
      { id: "b", status: "STOPPED" },
      { id: "c", status: "ERROR" },
    ])

    const health = await caller.health()

    expect(health.runtime.reachable).toBe(true)
    expect(health.runtime.error).toBeUndefined()
    expect(health.runtime.checkedAt).toBeInstanceOf(Date)
    expect(health.total).toBe(3)
    expect(health.counts).toEqual({ RUNNING: 1, STOPPED: 1, ERROR: 1 })
  })

  it("health surfaces the failure reason when the runtime is down", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
    const { caller } = await loadRouter()

    const health = await caller.health()

    expect(health.runtime.reachable).toBe(false)
    expect(health.runtime.error).toContain("ECONNREFUSED")
    expect(health.total).toBe(1)
    expect(health.counts).toEqual({ RUNNING: 0, STOPPED: 1, ERROR: 0 })
  })
})
