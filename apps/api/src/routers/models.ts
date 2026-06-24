import { z } from "zod";
import { router, protectedProcedure } from "../middleware/trpc";

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || "http://127.0.0.1:8001";

async function fetchFromRuntime<T>(path: string): Promise<T> {
  const res = await fetch(`${AGENT_RUNTIME_URL}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Runtime error: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postToRuntime<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AGENT_RUNTIME_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`Runtime error: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const modelsRouter = router({

  list: protectedProcedure.query(async () => {
    try {
      return await fetchFromRuntime<any[]>("/models");
    } catch {
      return [];
    }
  }),

  getProviders: protectedProcedure.query(async () => {
    try {
      return await fetchFromRuntime<any[]>("/models/providers");
    } catch {
      return [
        { id: "ollama", name: "Ollama", available: false, modelCount: 0 },
        { id: "openai", name: "Openai", available: false, modelCount: 0 },
        { id: "anthropic", name: "Anthropic", available: false, modelCount: 0 },
        { id: "google", name: "Google", available: false, modelCount: 0 },
        { id: "huggingface", name: "Huggingface", available: false, modelCount: 0 },
      ];
    }
  }),

  pullModel: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await postToRuntime<{ status: string }>("/models/pull/status", { name: input.name });
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : "Pull failed");
      }
    }),

  searchModels: protectedProcedure
    .input(z.object({ query: z.string().default("") }))
    .query(async ({ input }) => {
      try {
        return await fetchFromRuntime<any[]>(`/models/search?q=${encodeURIComponent(input.query)}`);
      } catch {
        return [];
      }
    }),

  getRuntimeHealth: protectedProcedure.query(async () => {
    try {
      const res = await fetch(`${AGENT_RUNTIME_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return { online: res.ok, status: res.ok ? "ok" : "error" };
    } catch {
      return { online: false, status: "unreachable" };
    }
  }),
});
