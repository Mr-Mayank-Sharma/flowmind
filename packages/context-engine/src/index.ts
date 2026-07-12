import { QdrantClient } from "@qdrant/js-client-rest"

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333"
const COLLECTION_NAME = "context_chunks"
const EMBEDDING_DIM = 384

export interface ContextChunk {
  id: string
  content: string
  score: number
  metadata: Record<string, unknown>
}

export interface ContextQuery {
  text: string
  userId: string
  topK?: number
  filters?: Record<string, unknown>
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "all-minilm", prompt: text }),
  })
  if (!res.ok) throw new Error(`Embedding API error: ${res.status}`)
  const data = await res.json()
  return data.embedding as number[]
}

function chunkText(text: string, maxLen = 512): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length)
    if (end < text.length) {
      const boundary = text.lastIndexOf(".", end)
      if (boundary > start) end = boundary + 1
    }
    chunks.push(text.slice(start, end).trim())
    start = end
  }
  return chunks
}

export class ContextEngine {
  private client: QdrantClient
  private ready: Promise<void>

  constructor() {
    this.client = new QdrantClient({ url: QDRANT_URL })
    this.ready = this.ensureCollection()
  }

  private async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections()
    if (!collections.collections.find((c: { name: string }) => c.name === COLLECTION_NAME)) {
      await this.client.createCollection(COLLECTION_NAME, {
        vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
      })
    }
  }

  async search(query: ContextQuery): Promise<ContextChunk[]> {
    await this.ready
    const queryVec = await embed(query.text)
    const filter: Record<string, unknown> = {
      must: [{ key: "userId", match: { value: query.userId } } as any],
    }
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        (filter.must as any[]).push({ key, match: { value } } as any)
      }
    }
    const result = await this.client.search(COLLECTION_NAME, {
      vector: queryVec,
      limit: query.topK ?? 5,
      filter: filter as any,
      with_payload: true,
    })
    return result.map((r) => {
      const p = r.payload as Record<string, unknown> | undefined
      return {
        id: String(r.id ?? ""),
        content: (p?.content as string) ?? "",
        score: r.score ?? 0,
        metadata: (p?.metadata as Record<string, unknown>) ?? {},
      } as ContextChunk
    })
  }

  async index(userId: string, docId: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.ready
    const chunks = chunkText(content)
    const points = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      const vec = await embed(chunk)
      points.push({
        id: `${docId}_${i}`,
        vector: vec,
        payload: { userId, docId, content: chunk, chunkIndex: i, metadata: metadata ?? {} },
      })
    }
    for (let i = 0; i < points.length; i += 10) {
      await this.client.upsert(COLLECTION_NAME, { points: points.slice(i, i + 10) })
    }
  }

  async delete(userId: string, docId: string): Promise<void> {
    await this.ready
    await this.client.delete(COLLECTION_NAME, {
      filter: {
        must: [
          { key: "userId", match: { value: userId } } as any,
          { key: "docId", match: { value: docId } } as any,
        ],
      },
    })
  }
}
