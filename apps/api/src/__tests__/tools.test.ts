import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    skill: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    orgSubscription: { findUnique: vi.fn() },
    session: { count: vi.fn() },
    pipeline: { count: vi.fn() },
  },
  skillEngineExecute: vi.fn(),
}));

vi.mock("@flowmind/skill-engine", () => {
  class SkillEngine {
    execute = mocks.skillEngineExecute;
  }
  return { SkillEngine };
});

vi.mock("@flowmind/db", () => ({ prisma: mocks.prisma }));

import { toolsRouter } from "../routers/tools";

function makeCtx() {
  return {
    prisma: mocks.prisma,
    userId: "user-1",
    hostClient: null,
    req: { method: "POST", headers: {} },
    res: {},
  } as never as Parameters<typeof toolsRouter.createCaller>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.findUnique.mockResolvedValue({ id: "user-1", tier: "FREE", orgId: null, role: "USER" });
  mocks.prisma.orgSubscription.findUnique.mockResolvedValue(null);
  mocks.prisma.session.count.mockResolvedValue(0);
  mocks.prisma.pipeline.count.mockResolvedValue(0);
  mocks.skillEngineExecute.mockResolvedValue({ output: "ran skill" });
});

describe("toolsRouter.execute skill ownership", () => {
  it("FORBIDDEN when a skill belongs to another user", async () => {
    mocks.prisma.skill.findUnique.mockResolvedValue({ id: "skill-1", userId: "user-2", name: "Secret" });

    const caller = toolsRouter.createCaller(makeCtx());

    let err: unknown;
    try {
      await caller.execute({ skillId: "skill-1", input: "run it" });
    } catch (e) {
      err = e;
    }

    expect(err).toMatchObject({ code: "FORBIDDEN" });
    expect((err as Error).message).toContain("only execute skills you own");
    expect(mocks.skillEngineExecute).not.toHaveBeenCalled();
  });

  it("executes a skill owned by the caller", async () => {
    mocks.prisma.skill.findUnique.mockResolvedValue({ id: "skill-1", userId: "user-1", name: "Mine" });

    const caller = toolsRouter.createCaller(makeCtx());

    const result = await caller.execute({ skillId: "skill-1", input: "run it" });

    expect(result).toEqual({ output: "ran skill" });
    expect(mocks.skillEngineExecute).toHaveBeenCalledWith("skill-1", { userId: "user-1", input: "run it" });
  });
});