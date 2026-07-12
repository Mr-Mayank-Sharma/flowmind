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

export class ContextEngine {
  async search(query: ContextQuery): Promise<ContextChunk[]> {
    return []
  }

  async index(userId: string, docId: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
  }

  async delete(userId: string, docId: string): Promise<void> {
  }
}
