import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("@flowmind/db", () => ({
  prisma: {
    mcpToken: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

beforeAll(() => {
  vi.stubEnv("GITHUB_CLIENT_ID", "mock-github-id");
  vi.stubEnv("SLACK_CLIENT_ID", "mock-slack-id");
  vi.stubEnv("GOOGLE_CLIENT_ID", "mock-google-id");
  vi.stubEnv("NOTION_CLIENT_ID", "mock-notion-id");
});

import { McpExecutor, McpServerRegistry, McpConnectionPool, McpToolRouter } from "../index";
import type { TokenStore } from "../index";

const mockTokenStore: TokenStore = {
  getToken: vi.fn().mockResolvedValue(null),
  setToken: vi.fn().mockResolvedValue(undefined),
  refreshToken: vi.fn().mockRejectedValue(new Error("not implemented")),
};

let executor: McpExecutor;

beforeEach(() => {
  vi.clearAllMocks();
  executor = new McpExecutor(
    new McpServerRegistry(),
    new McpConnectionPool(),
    new McpToolRouter(),
    mockTokenStore,
  );
});

describe("McpExecutor - PKCE", () => {
  it("initiateOAuthFlow generates a valid code_verifier and code_challenge for PKCE provider", async () => {
    const result = await executor.initiateOAuthFlow("slack", "http://localhost:3000/callback", "user-1");

    expect(result.url).toContain("code_challenge=");
    expect(result.url).toContain("code_challenge_method=S256");
    expect(result.state).toBeTruthy();
    expect(result.state.length).toBeGreaterThan(0);
  });

  it("initiateOAuthFlow does not include PKCE params for non-PKCE provider", async () => {
    const result = await executor.initiateOAuthFlow("github", "http://localhost:3000/callback", "user-1");

    expect(result.url).not.toContain("code_challenge=");
    expect(result.state).toBeTruthy();
  });

  it("initiateOAuthFlow throws for unknown provider", async () => {
    await expect(
      executor.initiateOAuthFlow("unknown", "http://localhost:3000/callback", "user-1"),
    ).rejects.toThrow("Unknown OAuth provider");
  });

  it("handleOAuthCallback throws for invalid state", async () => {
    await expect(
      executor.handleOAuthCallback("some-code", "invalid-state"),
    ).rejects.toThrow(/expired|invalid state/i);
  });
});
