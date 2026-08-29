import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  class SessionEngineMock {
    addMessage = vi.fn();
    getMessages = vi.fn(() => []);
    estimateTokens = vi.fn(() => 0);
    compact = vi.fn(async () => ({}));
    clear = vi.fn();
  }
  class SnapshotManagerMock {}
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      orgSubscription: { findUnique: vi.fn() },
      orgMember: { findUnique: vi.fn() },
      session: { count: vi.fn() },
      pipeline: { count: vi.fn() },
      subscription: { findUnique: vi.fn() },
      providerCredential: { upsert: vi.fn(), findMany: vi.fn() },
    },
    toolRegistry: { all: vi.fn(), get: vi.fn() },
    evaluate: vi.fn(),
    lspManager: {},
    SessionEngine: SessionEngineMock,
    SnapshotManager: SnapshotManagerMock,
    providerRegistry: {
      getProviders: vi.fn(),
      getModels: vi.fn(),
      searchModels: vi.fn(),
      getModel: vi.fn(),
      getProvider: vi.fn(),
      setApiKey: vi.fn(),
      getApiKey: vi.fn(),
    },
    pluginEngine: { getPlugins: vi.fn(), loadFromDir: vi.fn() },
    createTodoWriteTool: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  };
});

vi.mock("@flowmind/db", () => ({ prisma: mocks.prisma }));
vi.mock("@flowmind/tool-system", () => ({
  toolRegistry: mocks.toolRegistry,
  createTodoWriteTool: mocks.createTodoWriteTool,
}));
vi.mock("@flowmind/permission", () => ({ evaluate: mocks.evaluate }));
vi.mock("@flowmind/lsp", () => ({ lspManager: mocks.lspManager }));
vi.mock("@flowmind/snapshot", () => ({ SnapshotManager: mocks.SnapshotManager }));
vi.mock("@flowmind/session-engine", () => ({ SessionEngine: mocks.SessionEngine }));
vi.mock("@flowmind/provider-registry", () => ({ providerRegistry: mocks.providerRegistry }));
vi.mock("@flowmind/plugin-engine", () => ({ pluginEngine: mocks.pluginEngine }));
vi.mock("../lib/crypto", () => ({ encrypt: mocks.encrypt, decrypt: mocks.decrypt }));

import { toolsV2Router } from "../routers/tools-v2";

function makeCtx() {
  return {
    prisma: mocks.prisma,
    userId: "user-1",
    hostClient: null,
    req: { method: "POST", headers: {} },
    res: {},
  } as never as Parameters<typeof toolsV2Router.createCaller>[0];
}

function makeTool(id: string) {
  return {
    id,
    description: `tool ${id}`,
    parameters: {},
    jsonSchema: {},
    execute: vi.fn().mockResolvedValue({ output: `ran ${id}` }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-1", tier: "FREE", orgId: null, role: "USER" });
  mocks.prisma.orgSubscription.findUnique.mockResolvedValue(null);
  mocks.prisma.session.count.mockResolvedValue(0);
  mocks.prisma.pipeline.count.mockResolvedValue(0);
});

describe("toolsV2Router.executeTool approval gate", () => {
  it("FORBIDDEN when a destructive tool requests autoApprove with no server-side approval", async () => {
    const bashTool = makeTool("bash");
    mocks.toolRegistry.get.mockImplementation((id: string) => (id === "bash" ? bashTool : undefined));

    const caller = toolsV2Router.createCaller(makeCtx());

    await expect(
      caller.executeTool({ toolId: "bash", args: { cmd: "rm -rf /" }, autoApprove: true }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("No server-side approval found"),
    });
    expect(bashTool.execute).not.toHaveBeenCalled();
  });

  it("FORBIDDEN for a destructive tool without autoApprove confirmation", async () => {
    const bashTool = makeTool("bash");
    mocks.toolRegistry.get.mockImplementation((id: string) => (id === "bash" ? bashTool : undefined));

    const caller = toolsV2Router.createCaller(makeCtx());

    await expect(caller.executeTool({ toolId: "bash", args: { cmd: "rm -rf /" }, autoApprove: false })).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect(bashTool.execute).not.toHaveBeenCalled();
  });

  it("allows after approveToolExecution is consumed once, then denies a second run", async () => {
    const bashTool = makeTool("bash");
    mocks.toolRegistry.get.mockImplementation((id: string) => (id === "bash" ? bashTool : undefined));

    const caller = toolsV2Router.createCaller(makeCtx());

    const approval = await caller.approveToolExecution({ toolId: "bash", args: { cmd: "rm -rf /" } });
    expect(approval.approved).toBe(true);
    expect(approval.token).not.toBe("");

    const executed = await caller.executeTool({ toolId: "bash", args: { cmd: "rm -rf /" }, autoApprove: true });
    expect(executed.output).toBe("ran bash");
    expect(bashTool.execute).toHaveBeenCalledTimes(1);

    await expect(
      caller.executeTool({ toolId: "bash", args: { cmd: "rm -rf /" }, autoApprove: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(bashTool.execute).toHaveBeenCalledTimes(1);
  });

  it("does not accept an approval minted for different arguments", async () => {
    const bashTool = makeTool("bash");
    mocks.toolRegistry.get.mockImplementation((id: string) => (id === "bash" ? bashTool : undefined));

    const caller = toolsV2Router.createCaller(makeCtx());

    await caller.approveToolExecution({ toolId: "bash", args: { cmd: "touch /tmp/a" } });

    await expect(
      caller.executeTool({ toolId: "bash", args: { cmd: "rm -rf /" }, autoApprove: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(bashTool.execute).not.toHaveBeenCalled();
  });

  it("runs read-only tools without any approval", async () => {
    const readTool = makeTool("read");
    mocks.toolRegistry.get.mockImplementation((id: string) => (id === "read" ? readTool : undefined));

    const caller = toolsV2Router.createCaller(makeCtx());

    const executed = await caller.executeTool({ toolId: "read", args: { path: "/tmp/x" }, autoApprove: false });
    expect(executed.output).toBe("ran read");
    expect(readTool.execute).toHaveBeenCalledTimes(1);
  });
});