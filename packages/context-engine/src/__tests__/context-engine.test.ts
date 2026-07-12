import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQdrantClient = {
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  search: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: vi.fn(function () { return mockQdrantClient }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

mockQdrantClient.getCollections.mockResolvedValue({
  collections: [{ name: "context_chunks" }],
});

import { ContextEngine } from "../index";

let engine: ContextEngine;

beforeEach(() => {
  vi.clearAllMocks();
  mockQdrantClient.getCollections.mockResolvedValue({
    collections: [{ name: "context_chunks" }],
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ embedding: new Array(384).fill(0.1) }),
  });
  engine = new ContextEngine();
});

describe("ContextEngine", () => {
  it("search calls Qdrant with correct collection, vector and filter", async () => {
    mockQdrantClient.search.mockResolvedValue([
      { id: "1", payload: { content: "hello", metadata: {} }, score: 0.95 },
    ]);

    const results = await engine.search({ text: "test query", userId: "user-1", topK: 3 });

    expect(mockQdrantClient.search).toHaveBeenCalledWith("context_chunks", {
      vector: expect.any(Array),
      limit: 3,
      filter: { must: expect.arrayContaining([{ key: "userId", match: { value: "user-1" } }]) },
      with_payload: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe("hello");
    expect(results[0]!.score).toBe(0.95);
  });

  it("index calls Qdrant upsert with correct payload structure", async () => {
    await engine.index("user-1", "doc-1", "Hello world content", { source: "test" });

    expect(mockQdrantClient.upsert).toHaveBeenCalled();
    const upsertCall = mockQdrantClient.upsert.mock.calls[0] as [string, { points: Array<Record<string, unknown>> }];
    expect(upsertCall[0]).toBe("context_chunks");
    expect(upsertCall[1].points[0]).toMatchObject({
      id: "doc-1_0",
      payload: expect.objectContaining({
        userId: "user-1",
        docId: "doc-1",
        content: "Hello world content",
      }),
    });
  });

  it("delete calls Qdrant delete with correct userId and docId filter", async () => {
    await engine.delete("user-1", "doc-1");

    expect(mockQdrantClient.delete).toHaveBeenCalledWith("context_chunks", {
      filter: {
        must: [
          { key: "userId", match: { value: "user-1" } },
          { key: "docId", match: { value: "doc-1" } },
        ],
      },
    });
  });
});
