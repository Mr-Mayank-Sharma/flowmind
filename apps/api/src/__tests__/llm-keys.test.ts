import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiKey: vi.fn(),
  LLMEngine: vi.fn(function (this: { config: unknown }, config: unknown) {
    this.config = config;
  }),
}));

vi.mock("@flowmind/provider-registry", () => ({
  providerRegistry: { getApiKey: mocks.getApiKey },
}));

vi.mock("@flowmind/llm-router", () => ({
  LLMEngine: mocks.LLMEngine,
  resolveDefaultOllamaModel: vi.fn(),
}));

vi.mock("../lib/config", () => ({ config: {} }));

import { buildLLMConfig } from "../lib/llm-keys";
import { buildLLMProvider } from "../lib/llm-factory";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildLLMConfig", () => {
  it("merges a registry API key when the base config has none", () => {
    mocks.getApiKey.mockImplementation((id: string) => (id === "openai" ? "sk-registry-openai" : undefined));

    const merged = buildLLMConfig({});

    expect(merged.openaiKey).toBe("sk-registry-openai");
    expect(merged.anthropicKey).toBeUndefined();
    expect(mocks.getApiKey).toHaveBeenCalledWith("openai");
  });

  it("leaves a provider key undefined when the registry has none", () => {
    mocks.getApiKey.mockReturnValue(undefined);

    const merged = buildLLMConfig({});

    expect(merged.openaiKey).toBeUndefined();
    expect(merged.anthropicKey).toBeUndefined();
    expect(merged.ollamaBaseUrl).toBeUndefined();
  });

  it("never overwrites an explicitly configured key with a registry key", () => {
    mocks.getApiKey.mockReturnValue("sk-registry");

    const merged = buildLLMConfig({ openaiKey: "sk-base" });

    expect(merged.openaiKey).toBe("sk-base");
    expect(mocks.getApiKey).not.toHaveBeenCalledWith("openai");
  });

  it("honors the ollama base URL", () => {
    mocks.getApiKey.mockReturnValue(undefined);

    const merged = buildLLMConfig({ ollamaBaseUrl: "http://ollama.local:11434" });

    expect(merged.ollamaBaseUrl).toBe("http://ollama.local:11434");
  });
});

describe("buildLLMProvider", () => {
  it("returns undefined when no provider key is available", () => {
    mocks.getApiKey.mockReturnValue(undefined);

    expect(buildLLMProvider()).toBeUndefined();
    expect(mocks.LLMEngine).not.toHaveBeenCalled();
  });

  it("builds the engine with the registry-merged config and never leaks keys on the facade", () => {
    mocks.getApiKey.mockImplementation((id: string) => (id === "openai" ? "sk-super-secret" : undefined));
    mocks.LLMEngine.mockClear();

    const provider = buildLLMProvider();

    expect(provider).toBeDefined();
    expect(mocks.LLMEngine).toHaveBeenCalledTimes(1);

    const engineConfig = mocks.LLMEngine.mock.calls[0]![0] as Record<string, unknown>;
    expect(engineConfig.openaiKey).toBe("sk-super-secret");

    expect(provider).not.toHaveProperty("openaiKey");
    expect(provider).not.toHaveProperty("config");
    expect(JSON.stringify(provider)).not.toContain("sk-super-secret");
  });
});