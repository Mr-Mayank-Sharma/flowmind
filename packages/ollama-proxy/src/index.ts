const OLLAMA_BASE_URL = "http://localhost:11434"

export type OllamaModel = {
  name: string
  modifiedAt: string
  size: number
  digest: string
  details?: {
    format: string
    family: string
    families: string[]
    parameterSize: string
    quantizationLevel: string
  }
}

export type GenerateOptions = {
  system?: string
  template?: string
  context?: number[]
  stream?: boolean
  raw?: boolean
  format?: string
  options?: {
    temperature?: number
    topP?: number
    topK?: number
    numPredict?: number
    stop?: string[]
    repeatPenalty?: number
    seed?: number
    numGpu?: number
  }
}

export type GenerateResponse = {
  model: string
  response: string
  done: boolean
  context?: number[]
  totalDuration?: number
  loadDuration?: number
  promptEvalCount?: number
  evalCount?: number
}

export type EmbeddingResponse = {
  embedding: number[]
}

export type ModelPullProgress = {
  status: string
  digest?: string
  total?: number
  completed?: number
}

export type GpuInfo = {
  index: number
  name: string
  temperature: number
  utilization: number
  memoryTotal: number
  memoryUsed: number
}

export type CloudFallbackBadge = {
  modelName: string
  localAvailable: boolean
  fallbackActive: boolean
  fallbackProvider?: string
  lastCheck: Date
}

export class ModelManager {
  async list(): Promise<OllamaModel[]> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!res.ok) throw new Error(`Ollama list failed: ${res.statusText}`)
    const data = await res.json() as { models: OllamaModel[] }
    return data.models ?? []
  }

  async pull(modelName: string, onProgress?: (progress: ModelPullProgress) => void): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
    })
    if (!res.ok) throw new Error(`Ollama pull failed: ${res.statusText}`)

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).trim().split("\n")
      for (const line of lines) {
        try {
          const progress = JSON.parse(line) as ModelPullProgress
          onProgress?.(progress)
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async delete(modelName: string): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
    })
    if (!res.ok) throw new Error(`Ollama delete failed: ${res.statusText}`)
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

export async function generate(
  model: string,
  prompt: string,
  options?: GenerateOptions,
): Promise<GenerateResponse> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, ...options }),
  })
  if (!res.ok) throw new Error(`Ollama generate failed: ${res.statusText}`)
  return await res.json() as GenerateResponse
}

export async function* generateStream(
  model: string,
  prompt: string,
  options?: GenerateOptions,
): AsyncGenerator<GenerateResponse> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: true, ...options }),
  })
  if (!res.ok) throw new Error(`Ollama generate stream failed: ${res.statusText}`)

  const reader = res.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).trim().split("\n")
    for (const line of lines) {
      if (!line) continue
      yield JSON.parse(line) as GenerateResponse
    }
  }
}

export async function getEmbeddings(model: string, input: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: input }),
  })
  if (!res.ok) throw new Error(`Ollama embeddings failed: ${res.statusText}`)
  const data = await res.json() as EmbeddingResponse
  return data.embedding
}

export async function getGpuInfo(): Promise<GpuInfo[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/gpu`, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return []
    type GpuResponse = { gpus?: GpuInfo[] }
    const data = await res.json() as GpuResponse
    return data.gpus ?? []
  } catch {
    return []
  }
}

export class OllamaProxy {
  private modelManager: ModelManager
  private badges: Map<string, CloudFallbackBadge> = new Map()

  constructor() {
    this.modelManager = new ModelManager()
  }

  get models(): ModelManager {
    return this.modelManager
  }

  async isAvailable(): Promise<boolean> {
    return checkHealth()
  }

  async generate(model: string, prompt: string, options?: GenerateOptions): Promise<GenerateResponse> {
    const available = await this.isAvailable()
    if (!available) {
      throw new Error("Ollama is not available. Cannot generate.")
    }
    return generate(model, prompt, options)
  }

  async getEmbeddings(model: string, input: string): Promise<number[]> {
    const available = await this.isAvailable()
    if (!available) {
      throw new Error("Ollama is not available. Cannot generate embeddings.")
    }
    return getEmbeddings(model, input)
  }

  async updateBadges(): Promise<void> {
    const available = await this.isAvailable()
    let models: OllamaModel[] = []
    if (available) {
      try {
        models = await this.modelManager.list()
      } catch {
        models = []
      }
    }

    for (const m of models) {
      const existing = this.badges.get(m.name)
      this.badges.set(m.name, {
        modelName: m.name,
        localAvailable: available,
        fallbackActive: false,
        fallbackProvider: existing?.fallbackProvider,
        lastCheck: new Date(),
      })
    }
  }

  getBadge(modelName: string): CloudFallbackBadge | undefined {
    return this.badges.get(modelName)
  }

  getAllBadges(): CloudFallbackBadge[] {
    return Array.from(this.badges.values())
  }

  setFallbackProvider(modelName: string, provider: string): void {
    const existing = this.badges.get(modelName)
    this.badges.set(modelName, {
      modelName,
      localAvailable: existing?.localAvailable ?? false,
      fallbackActive: true,
      fallbackProvider: provider,
      lastCheck: new Date(),
    })
  }

  async detectGpu(): Promise<GpuInfo[]> {
    const gpus = await getGpuInfo()
    return gpus
  }
}
