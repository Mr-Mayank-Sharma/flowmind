import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.hoisted(() => {
  delete process.env.JWT_SECRET;
});

vi.mock("@flowmind/db", () => ({
  prisma: {},
  Prisma: {},
}));

beforeEach(() => {
  vi.resetModules();
  delete process.env.JWT_SECRET;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.NODE_ENV;
});

function strategySecret(strategy: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    (strategy as {
      _secretOrKeyProvider: (req: unknown, token: unknown, done: (err: Error | null, secret?: string) => void) => void;
    })._secretOrKeyProvider(null, null, (err, secret) => {
      if (err) reject(err);
      else resolve(secret ?? "");
    });
  });
}

describe("auth JWT secret resolution", () => {
  it("uses the configured JWT_SECRET when present", async () => {
    process.env.JWT_SECRET = "configured-secret";

    const mod = await import("../strategies/jwt");

    await expect(strategySecret(mod.jwtStrategy)).resolves.toBe("configured-secret");
  });

  it("falls back with a warning in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../strategies/jwt");

    await expect(strategySecret(mod.jwtStrategy)).resolves.toBe("dev-secret-change-in-production-32chars!");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET not set"));
    warn.mockRestore();
  });

  it("refuses to build a strategy in production without a secret", async () => {
    process.env.NODE_ENV = "production";

    await expect(import("../strategies/jwt")).rejects.toThrow("JWT_SECRET must be set in production");
  });
});