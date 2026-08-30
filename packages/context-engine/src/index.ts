import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"

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
  groupId?: string
  topK?: number
  filters?: Record<string, unknown>
}

interface MemoryPoint {
  id: string
  vector: number[]
  payload: Record<string, unknown>
}

async function embed(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434"
  const model = process.env.EMBEDDING_MODEL || "all-minilm"
  const res = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
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

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function matchesFilter(payload: Record<string, unknown>, key: string, value: unknown): boolean {
  const actual = payload[key]
  if (actual === value) return true
  if (actual === null || actual === undefined) return false
  if (Array.isArray(actual)) return (actual as unknown[]).includes(value)
  return false
}

function pointId(docId: string, chunkIndex: number): string {
  const digest = createHash("sha256").update(`${docId}_${chunkIndex}`).digest("hex")
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`
}

export class ContextEngine {
  private client: QdrantClient
  private ready: Promise<void>
  private memory: MemoryPoint[]
  private memoryMode: boolean

  constructor() {
    this.client = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" })
    this.memory = []
    this.memoryMode = false
    this.ready = this.ensureCollection().catch(() => {
      this.memoryMode = true
    })
  }

  private async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections()
    if (!collections.collections.find((c: { name: string }) => c.name === COLLECTION_NAME)) {
      await this.client.createCollection(COLLECTION_NAME, {
        vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
      })
    }
  }

  private buildFilter(query: ContextQuery): Record<string, unknown> {
    const must: Record<string, unknown>[] = [{ key: "userId", match: { value: query.userId } }]
    if (query.groupId) must.push({ key: "groupId", match: { value: query.groupId } })
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        must.push({ key, match: { value } })
      }
    }
    return { must }
  }

  async search(query: ContextQuery): Promise<ContextChunk[]> {
    await this.ready
    if (this.memoryMode) return this.searchMemory(query)
    const queryVec = await embed(query.text)
    const result = await this.client.search(COLLECTION_NAME, {
      vector: queryVec,
      limit: query.topK ?? 5,
      filter: this.buildFilter(query) as any,
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

  private async searchMemory(query: ContextQuery): Promise<ContextChunk[]> {
    const queryVec = await embed(query.text)
    const scored: ContextChunk[] = []
    for (const point of this.memory) {
      const payload = point.payload
      if (payload["userId"] !== query.userId) continue
      if (query.groupId && payload["groupId"] !== query.groupId) continue
      if (query.filters) {
        let ok = true
        for (const [key, value] of Object.entries(query.filters)) {
          if (!matchesFilter(payload, key, value)) {
            ok = false
            break
          }
        }
        if (!ok) continue
      }
      scored.push({
        id: point.id,
        content: (payload["content"] as string) ?? "",
        score: cosine(queryVec, point.vector),
        metadata: (payload["metadata"] as Record<string, unknown>) ?? {},
      })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, query.topK ?? 5)
  }

  async index(userId: string, docId: string, content: string, metadata?: Record<string, unknown>, groupId?: string): Promise<void> {
    await this.ready
    const chunks = chunkText(content)
    if (this.memoryMode) {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!
        const vector = await embed(chunk)
        this.memory.push({
          id: `${docId}_${i}`,
          vector,
          payload: { userId, groupId, docId, content: chunk, chunkIndex: i, metadata: metadata ?? {} },
        })
      }
      return
    }
    const points = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      const vec = await embed(chunk)
      points.push({
        id: pointId(docId, i),
        vector: vec,
        payload: { userId, groupId, docId, content: chunk, chunkIndex: i, metadata: metadata ?? {} },
      })
    }
    for (let i = 0; i < points.length; i += 10) {
      await this.client.upsert(COLLECTION_NAME, { points: points.slice(i, i + 10) })
    }
  }

  async delete(userId: string, docId: string, groupId?: string): Promise<void> {
    await this.ready
    if (this.memoryMode) {
      this.memory = this.memory.filter(
        (point) => point.payload["docId"] !== docId || point.payload["userId"] !== userId || (groupId !== undefined && point.payload["groupId"] !== groupId),
      )
      return
    }
    const must: Record<string, unknown>[] = [
      { key: "userId", match: { value: userId } },
      { key: "docId", match: { value: docId } },
    ]
    if (groupId) must.push({ key: "groupId", match: { value: groupId } })
    await this.client.delete(COLLECTION_NAME, {
      filter: { must } as any,
    })
  }

  get mode(): string {
    return this.memoryMode ? "memory" : "qdrant"
  }
}
