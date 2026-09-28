import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The fallback warning goes through the structured logger rather than the console, so
// the module is mocked at its boundary. `vi.hoisted` keeps the spy object the factory
// closes over the same one the assertions read, even though `resetModules` hands every
// dynamic import a fresh copy of the mocked module.
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../infrastructure", () => ({ logger: loggerMock }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.JWT_SECRET;
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.NODE_ENV;
});

describe("JWT secret resolution", () => {
  it("uses the configured JWT_SECRET when present", async () => {
    process.env.JWT_SECRET = "configured-secret";

    const { JWT_SECRET } = await import("../lib/jwt-secret");

    expect(JWT_SECRET).toBe("configured-secret");
  });

  it("falls back with a warning in development", async () => {
    const { JWT_SECRET } = await import("../lib/jwt-secret");

    expect(JWT_SECRET).toBe("dev-secret-change-in-production-32chars!");
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET not set"));
  });

  it("refuses to start in production without a secret", async () => {
    process.env.NODE_ENV = "production";

    await expect(import("../lib/jwt-secret")).rejects.toThrow("JWT_SECRET must be set in production");
  });
});