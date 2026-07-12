import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@flowmind/db", () => ({
  prisma: {
    skill: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { SkillEngine } from "../index";
import type { SkillDefinition } from "../index";

const makeSkill = (overrides: Partial<SkillDefinition> = {}): SkillDefinition => ({
  id: "test-skill-1",
  userId: "user-1",
  name: "test",
  description: "test skill",
  code: "return input.toUpperCase()",
  version: 1,
  isActive: true,
  ...overrides,
});

let engine: SkillEngine;

beforeEach(() => {
  vi.clearAllMocks();
  engine = new SkillEngine();
});

describe("SkillEngine - sandbox security", () => {
  it("executes benign skill code and returns result", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: "test-skill-1",
      userId: "user-1",
      name: "test",
      description: "",
      triggerPattern: null,
      code: "return `hello ${input}`",
      version: 1,
      isActive: true,
      successRate: null,
      successCount: 0,
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    const result = await engine.execute("test-skill-1", { userId: "user-1", input: "world" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("hello world");
  });

  it("throws when skill attempts process.exit(1)", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: "test-skill-1",
      userId: "user-1",
      name: "test",
      description: "",
      triggerPattern: null,
      code: "process.exit(1)",
      version: 1,
      isActive: true,
      successRate: null,
      successCount: 0,
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    const result = await engine.execute("test-skill-1", { userId: "user-1", input: "x" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("process is not defined");
  });

  it("prevents reading process.env", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: "test-skill-1",
      userId: "user-1",
      name: "test",
      description: "",
      triggerPattern: null,
      code: "return process.env.STRIPE_SECRET_KEY || 'none'",
      version: 1,
      isActive: true,
      successRate: null,
      successCount: 0,
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    const result = await engine.execute("test-skill-1", { userId: "user-1", input: "x" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("process is not defined");
  });

  it("times out on infinite loop", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: "test-skill-1",
      userId: "user-1",
      name: "test",
      description: "",
      triggerPattern: null,
      code: "while(true){}",
      version: 1,
      isActive: true,
      successRate: null,
      successCount: 0,
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    const result = await engine.execute("test-skill-1", { userId: "user-1", input: "x" });
    expect(result.success).toBe(false);
    expect(result.output).toMatch(/timeout|timed out/i);
  }, 10000);

  it("prevents require access", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: "test-skill-1",
      userId: "user-1",
      name: "test",
      description: "",
      triggerPattern: null,
      code: "return require('fs').readdirSync('/')",
      version: 1,
      isActive: true,
      successRate: null,
      successCount: 0,
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    const result = await engine.execute("test-skill-1", { userId: "user-1", input: "x" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("require is not defined");
  });
});

describe("SkillEngine - userId fix", () => {
  it("register() uses explicit userId, not derived from id", async () => {
    const { prisma } = await import("@flowmind/db");
    const findFirst = vi.mocked(prisma.skill.findFirst);

    await engine.register(makeSkill({ userId: "real-user-id" }));

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "real-user-id" }),
      }),
    );
  });

  it("register() creates a new skill for the correct userId", async () => {
    const { prisma } = await import("@flowmind/db");
    const findFirst = vi.mocked(prisma.skill.findFirst);
    const create = vi.mocked(prisma.skill.create);
    findFirst.mockResolvedValue(null);

    await engine.register(makeSkill({ userId: "user-42" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-42" }),
      }),
    );
  });
});

describe("SkillEngine - successRate", () => {
  it("recalculates successRate on execute", async () => {
    const { prisma } = await import("@flowmind/db");
    vi.mocked(prisma.skill.findUnique)
      .mockResolvedValueOnce({
        id: "test-skill-1",
        userId: "user-1",
        name: "test",
        description: "",
        triggerPattern: null,
        code: "return 'ok'",
        version: 1,
        isActive: true,
        successRate: null,
        successCount: 0,
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "test-skill-1",
        userId: "user-1",
        name: "test",
        description: "",
        triggerPattern: null,
        code: "return 'ok'",
        version: 1,
        isActive: true,
        successRate: null,
        successCount: 1,
        useCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    await engine.execute("test-skill-1", { userId: "user-1", input: "x" });

    const updateCalls = vi.mocked(prisma.skill.update).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1]!;
    expect(lastCall[0]!.data).toEqual({ successRate: 100 });
  });
});
