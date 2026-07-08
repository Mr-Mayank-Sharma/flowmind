import { spawn, ChildProcess } from "child_process"
import path from "path"
import fs from "fs"

export interface LSPDiagnostic {
  filePath: string
  line: number
  column: number
  severity: "error" | "warning" | "info" | "hint"
  message: string
  code?: string
}

export interface LSPDefinition {
  filePath: string
  line: number
  column: number
}

export interface LSPReference {
  filePath: string
  line: number
  column: number
  text: string
}

const languageServers: Record<string, { command: string; args: string[]; language: string }> = {
  typescript: { command: "typescript-language-server", args: ["--stdio"], language: "typescript" },
  javascript: { command: "typescript-language-server", args: ["--stdio"], language: "javascript" },
  python: { command: "pyright-langserver", args: ["--stdio"], language: "python" },
  go: { command: "gopls", args: [], language: "go" },
  rust: { command: "rust-analyzer", args: [], language: "rust" },
  css: { command: "vscode-css-language-server", args: ["--stdio"], language: "css" },
  html: { command: "vscode-html-language-server", args: ["--stdio"], language: "html" },
  json: { command: "vscode-json-language-server", args: ["--stdio"], language: "json" },
}

function detectLanguage(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".html": "html", ".htm": "html",
    ".json": "json",
  }
  return map[ext]
}

export class LSPClient {
  private process: ChildProcess | null = null
  private requestId = 0
  private callbacks = new Map<number, { resolve: (value: any) => void; reject: (err: Error) => void }>()
  private buffer = ""
  private capabilities: any = null
  private initialized = false

  constructor(private language: string, private rootPath: string) {}

  async start(): Promise<void> {
    const config = languageServers[this.language]
    if (!config) throw new Error(`No LSP server configured for ${this.language}`)

    this.process = spawn(config.command, config.args, {
      cwd: this.rootPath,
      stdio: ["pipe", "pipe", "pipe"],
    })

    this.process.stdout?.on("data", (data: Buffer) => {
      this.buffer += data.toString()
      this.processMessages()
    })

    this.process.stderr?.on("data", (data: Buffer) => {
      // LSP servers often log to stderr
    })

    await this.sendRequest("initialize", {
      processId: process.pid,
      rootUri: `file://${this.rootPath}`,
      capabilities: {
        textDocument: {
          synchronization: { didSave: true },
          completion: {},
          hover: {},
          definition: {},
          references: {},
          documentSymbol: {},
        },
      },
    })

    await this.sendNotification("initialized", {})
    this.initialized = true
  }

  async openDocument(filePath: string): Promise<void> {
    if (!this.initialized) await this.start()
    const content = fs.readFileSync(filePath, "utf-8")
    const uri = `file://${filePath}`
    await this.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: this.language, version: 1, text: content },
    })
  }

  async getDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    if (!this.initialized) await this.start()
    const uri = `file://${filePath}`
    const response = await this.sendRequest("textDocument/publishDiagnostics", {
      uri,
      diagnostics: [],
    }, true)
    return []
  }

  async goToDefinition(filePath: string, line: number, column: number): Promise<LSPDefinition | null> {
    if (!this.initialized) await this.start()
    const uri = `file://${filePath}`
    const response = await this.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position: { line, character: column },
    })
    if (response?.result) {
      const loc = Array.isArray(response.result) ? response.result[0] : response.result
      if (loc?.uri) {
        return {
          filePath: loc.uri.replace("file://", ""),
          line: loc.range?.start?.line ?? 0,
          column: loc.range?.start?.character ?? 0,
        }
      }
    }
    return null
  }

  async findReferences(filePath: string, line: number, column: number): Promise<LSPReference[]> {
    if (!this.initialized) await this.start()
    const uri = `file://${filePath}`
    const response = await this.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line, character: column },
      context: { includeDeclaration: true },
    })
    if (response?.result && Array.isArray(response.result)) {
      return response.result.map((loc: any) => ({
        filePath: loc.uri.replace("file://", ""),
        line: loc.range?.start?.line ?? 0,
        column: loc.range?.start?.character ?? 0,
        text: "",
      }))
    }
    return []
  }

  async getHover(filePath: string, line: number, column: number): Promise<string | null> {
    if (!this.initialized) await this.start()
    const uri = `file://${filePath}`
    const response = await this.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position: { line, character: column },
    })
    if (response?.result?.contents) {
      const contents = response.result.contents
      return typeof contents === "string" ? contents : Array.isArray(contents) ? contents.join("\n") : JSON.stringify(contents)
    }
    return null
  }

  async stop(): Promise<void> {
    try {
      await this.sendNotification("exit", {})
    } catch {}
    this.process?.kill()
    this.process = null
    this.initialized = false
  }

  private sendRequest(method: string, params: any, noWait = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      if (!noWait) this.callbacks.set(id, { resolve, reject })
      this.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }))
      if (noWait) resolve(null)
    })
  }

  private sendNotification(method: string, params: any): Promise<void> {
    this.send(JSON.stringify({ jsonrpc: "2.0", method, params }))
    return Promise.resolve()
  }

  private send(message: string): void {
    const header = `Content-Length: ${Buffer.byteLength(message, "utf-8")}\r\n\r\n`
    this.process?.stdin?.write(header + message)
  }

  private processMessages(): void {
    while (this.buffer.length > 0) {
      const match = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/)
      if (!match) break
      const contentLength = parseInt(match[1]!, 10)
      const headerEnd = match.index! + match[0].length
      if (this.buffer.length < headerEnd + contentLength) break

      const content = this.buffer.slice(headerEnd, headerEnd + contentLength)
      this.buffer = this.buffer.slice(headerEnd + contentLength)

      try {
        const msg = JSON.parse(content)
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id)!
          this.callbacks.delete(msg.id)
          if (msg.error) cb.reject(new Error(msg.error.message))
          else cb.resolve(msg)
        }
      } catch {}
    }
  }
}

export class LSPManager {
  private clients = new Map<string, LSPClient>()

  getClient(filePath: string): LSPClient | undefined {
    const lang = detectLanguage(filePath)
    if (!lang) return undefined
    const root = this.findRoot(filePath)
    const key = `${lang}:${root}`

    if (!this.clients.has(key)) {
      const client = new LSPClient(lang, root)
      this.clients.set(key, client)
    }
    return this.clients.get(key)
  }

  async openFile(filePath: string): Promise<void> {
    const client = this.getClient(filePath)
    if (client) await client.openDocument(filePath)
  }

  async goToDefinition(filePath: string, line: number, column: number) {
    const client = this.getClient(filePath)
    return client?.goToDefinition(filePath, line, column) ?? null
  }

  async findReferences(filePath: string, line: number, column: number) {
    const client = this.getClient(filePath)
    return client?.findReferences(filePath, line, column) ?? []
  }

  async getHover(filePath: string, line: number, column: number) {
    const client = this.getClient(filePath)
    return client?.getHover(filePath, line, column) ?? null
  }

  async stopAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.stop()
    }
    this.clients.clear()
  }

  private findRoot(filePath: string): string {
    let dir = path.dirname(filePath)
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, "package.json")) ||
          fs.existsSync(path.join(dir, "tsconfig.json")) ||
          fs.existsSync(path.join(dir, ".git"))) {
        return dir
      }
      dir = path.dirname(dir)
    }
    return path.dirname(filePath)
  }
}

export const lspManager = new LSPManager()
