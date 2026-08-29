import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
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
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { JWT_SECRET } = await import("../lib/jwt-secret");

    expect(JWT_SECRET).toBe("dev-secret-change-in-production-32chars!");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET not set"));
    warn.mockRestore();
  });

  it("refuses to start in production without a secret", async () => {
    process.env.NODE_ENV = "production";

    await expect(import("../lib/jwt-secret")).rejects.toThrow("JWT_SECRET must be set in production");
  });
});