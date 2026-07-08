import fs from "fs"
import path from "path"
import crypto from "crypto"

export interface RequestSnapshot {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export interface ResponseSnapshot {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

export interface HttpInteraction {
  id: string
  request: RequestSnapshot
  response: ResponseSnapshot
  timestamp: number
  durationMs: number
}

export interface Cassette {
  name: string
  interactions: HttpInteraction[]
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface RedactOptions {
  headers?: string[]
  bodyFields?: string[]
}

export interface RecorderOptions {
  cassetteName: string
  cassetteDir?: string
  recordIfMissing?: boolean
  redact?: RedactOptions
}

const defaultRedactOptions: RedactOptions = {
  headers: ["authorization", "x-api-key", "cookie", "set-cookie"],
  bodyFields: ["api_key", "apiKey", "apikey", "password", "secret", "token", "key"],
}

function redactHeaders(headers: Record<string, string>, redact: RedactOptions): Record<string, string> {
  const result = { ...headers }
  for (const h of redact.headers ?? []) {
    const key = Object.keys(result).find((k) => k.toLowerCase() === h.toLowerCase())
    if (key) result[key] = "[REDACTED]"
  }
  return result
}

function redactBody(body: string, redact: RedactOptions): string {
  let result = body
  for (const field of redact.bodyFields ?? []) {
    try {
      const parsed = JSON.parse(result)
      if (typeof parsed === "object" && parsed !== null) {
        const redactRecursive = (obj: Record<string, unknown>, field: string) => {
          for (const key of Object.keys(obj)) {
            if (key.toLowerCase().includes(field.toLowerCase())) {
              obj[key] = "[REDACTED]"
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
              redactRecursive(obj[key] as Record<string, unknown>, field)
            }
          }
        }
        redactRecursive(parsed, field)
        result = JSON.stringify(parsed)
      }
    } catch {}
  }
  return result
}

function generateId(): string {
  return crypto.randomUUID()
}

export class CassetteRecorder {
  private interactions: HttpInteraction[] = []
  private options: RecorderOptions & { redact: RedactOptions }

  constructor(options: RecorderOptions) {
    this.options = { ...options, redact: { ...defaultRedactOptions, ...options.redact } }
  }

  async record<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    const origFetch = globalThis.fetch
    const captured: HttpInteraction[] = []

    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const reqStart = Date.now()
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method ?? "GET")).toUpperCase()
      const reqHeaders: Record<string, string> = {}
      const h = init?.headers ?? (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined)
      if (h instanceof Headers) h.forEach((v, k) => { reqHeaders[k] = v })
      else if (typeof h === "object" && h !== null) Object.assign(reqHeaders, h)

      let reqBody: string | undefined
      if (init?.body) reqBody = typeof init.body === "string" ? init.body : "[non-string body]"

      const response = await origFetch(input, init)
      const resClone = response.clone()
      const resBody = await resClone.text()

      const interaction: HttpInteraction = {
        id: generateId(),
        request: {
          method,
          url,
          headers: redactHeaders(reqHeaders, this.options.redact),
          body: reqBody ? redactBody(reqBody, this.options.redact) : undefined,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: redactHeaders(Object.fromEntries(response.headers.entries()), this.options.redact),
          body: redactBody(resBody, this.options.redact),
        },
        timestamp: Date.now(),
        durationMs: Date.now() - reqStart,
      }

      captured.push(interaction)
      return response
    }

    globalThis.fetch = wrappedFetch as typeof fetch

    try {
      const result = await fn()
      this.interactions.push(...captured)
      return result
    } finally {
      globalThis.fetch = origFetch
    }
  }

  save(): void {
    const cassetteDir = this.options.cassetteDir ?? path.join(process.cwd(), "__cassettes__")
    if (!fs.existsSync(cassetteDir)) fs.mkdirSync(cassetteDir, { recursive: true })
    const filePath = path.join(cassetteDir, `${this.options.cassetteName}.json`)
    const cassette: Cassette = {
      name: this.options.cassetteName,
      interactions: this.interactions,
      createdAt: Date.now(),
    }
    fs.writeFileSync(filePath, JSON.stringify(cassette, null, 2), "utf-8")
  }

  getInteractions(): HttpInteraction[] {
    return [...this.interactions]
  }

  clear(): void {
    this.interactions = []
  }
}

export class CassetteReplayer {
  private cassette: Cassette
  private interactionIndex = 0

  constructor(cassetteOrPath: Cassette | string) {
    if (typeof cassetteOrPath === "string") {
      const content = fs.readFileSync(cassetteOrPath, "utf-8")
      this.cassette = JSON.parse(content) as Cassette
    } else {
      this.cassette = cassetteOrPath
    }
  }

  async install(): Promise<() => void> {
    const origFetch = globalThis.fetch

    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? "GET").toUpperCase()

      const interaction = this.findInteraction(method, url)
      if (!interaction) {
        throw new Error(`No recorded interaction for ${method} ${url}`)
      }

      const { response } = interaction
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    globalThis.fetch = wrappedFetch as typeof fetch

    return () => {
      globalThis.fetch = origFetch
    }
  }

  private findInteraction(method: string, url: string): HttpInteraction | undefined {
    for (let i = this.interactionIndex; i < this.cassette.interactions.length; i++) {
      const interaction = this.cassette.interactions[i]!
      if (interaction.request.method === method && interaction.request.url === url) {
        this.interactionIndex = i + 1
        return interaction
      }
    }
    return undefined
  }

  getCassette(): Cassette {
    return this.cassette
  }

  reset(): void {
    this.interactionIndex = 0
  }
}

export async function loadCassette(filePath: string): Promise<Cassette> {
  const content = await fs.promises.readFile(filePath, "utf-8")
  return JSON.parse(content) as Cassette
}

export async function saveCassette(cassette: Cassette, dir?: string): Promise<string> {
  const cassetteDir = dir ?? path.join(process.cwd(), "__cassettes__")
  if (!fs.existsSync(cassetteDir)) await fs.promises.mkdir(cassetteDir, { recursive: true })
  const filePath = path.join(cassetteDir, `${cassette.name}.json`)
  await fs.promises.writeFile(filePath, JSON.stringify(cassette, null, 2), "utf-8")
  return filePath
}
