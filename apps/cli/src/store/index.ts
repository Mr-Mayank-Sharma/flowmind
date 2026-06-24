import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import type { Agent, ModelProvider, MCPServer, Session, Pipeline, ChatSession } from "../types.js"

const API_URL = process.env.FLOWMIND_API_URL || "http://localhost:3001"

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/trpc/${path}?input={}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.result?.data as T ?? null
  } catch {
    return null
  }
}

const FLOWMIND_DIR = join(homedir(), ".flowmind")
const DATA_FILE = join(FLOWMIND_DIR, "state.json")

interface StoreData {
  agents: Agent[]
  models: ModelProvider[]
  mcpServers: MCPServer[]
  sessions: Session[]
  pipelines: Pipeline[]
  chatSessions: ChatSession[]
  user: { email: string; name: string } | null
}

function getDefaultData(): StoreData {
  return {
    agents: [
      { id: "a1", name: "Research Assistant", role: "Researcher", model: "claude-3-opus", provider: "Anthropic", status: "active", memoryEnabled: true, costCap: 50, costSpent: 12.4, tools: 5, createdAt: "2024-12-01" },
      { id: "a2", name: "Code Reviewer", role: "Developer", model: "gpt-4o", provider: "OpenAI", status: "active", memoryEnabled: true, costCap: 100, costSpent: 34.8, tools: 8, createdAt: "2024-12-05" },
      { id: "a3", name: "Data Analyst", role: "Analyst", model: "gpt-4-turbo", provider: "OpenAI", status: "idle", memoryEnabled: false, costCap: 75, costSpent: 22.1, tools: 6, createdAt: "2024-12-10" },
    ],
    models: [
      { id: "openai", name: "OpenAI", icon: "🧠", apiKeyConfigured: false, models: [{ name: "gpt-4o", contextWindow: 128000, inputPrice: 2.5, outputPrice: 10, capabilities: ["text", "vision", "function-calling"], isLocal: false }] },
      { id: "ollama", name: "Ollama", icon: "🦙", baseUrl: "http://localhost:11434", apiKeyConfigured: true, models: [{ name: "llama3-70b", contextWindow: 8192, inputPrice: 0, outputPrice: 0, capabilities: ["text", "code"], isLocal: true }] },
    ],
    mcpServers: [
      { id: "s1", name: "Filesystem", description: "Read, write, and manage files", type: "built-in", status: "connected", tools: ["read_file", "write_file", "list_dir"], lastActive: "just now" },
    ],
    sessions: [
      { id: "s1", name: "Code Review Session", agentName: "Code Reviewer", tokens: 45230, memoryCount: 12, lastActive: "2 min ago", status: "active" },
    ],
    pipelines: [
      { id: "p1", name: "Customer Support Agent", description: "Automated customer inquiry handling", status: "ACTIVE", lastRunAt: "2 hours ago", nodeCount: 8 },
    ],
    chatSessions: [],
    user: null,
  }
}

let cache: StoreData | null = null

function ensureDir(): void {
  if (!existsSync(FLOWMIND_DIR)) {
    mkdirSync(FLOWMIND_DIR, { recursive: true })
  }
}

function load(): StoreData {
  if (cache) return cache
  ensureDir()
  if (!existsSync(DATA_FILE)) {
    const data = getDefaultData()
    save(data)
    cache = data
    return data
  }
  try {
    const raw = readFileSync(DATA_FILE, "utf-8")
    const data = JSON.parse(raw) as StoreData
    cache = data
    return data
  } catch {
    const data = getDefaultData()
    save(data)
    cache = data
    return data
  }
}

function save(data: StoreData): void {
  ensureDir()
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
  cache = data
}

export function getAgents(): Agent[] {
  return load().agents
}

export function addAgent(agent: Agent): void {
  const data = load()
  data.agents.unshift(agent)
  save(data)
}

export function deleteAgent(id: string): void {
  const data = load()
  data.agents = data.agents.filter(a => a.id !== id)
  save(data)
}

export function updateAgent(id: string, updates: Partial<Agent>): void {
  const data = load()
  data.agents = data.agents.map(a => a.id === id ? { ...a, ...updates } : a)
  save(data)
}

export function getModels(): ModelProvider[] {
  return load().models
}

export function updateModelApiKey(providerId: string, key: string): void {
  const data = load()
  data.models = data.models.map(m => m.id === providerId ? { ...m, apiKeyConfigured: true } : m)
  save(data)
}

export function getMCPServers(): MCPServer[] {
  return load().mcpServers
}

export function addMCPServer(server: MCPServer): void {
  const data = load()
  data.mcpServers.unshift(server)
  save(data)
}

export function deleteMCPServer(id: string): void {
  const data = load()
  data.mcpServers = data.mcpServers.filter(s => s.id !== id)
  save(data)
}

export function getSessions(): Session[] {
  return load().sessions
}

export function getPipelines(): Pipeline[] {
  return load().pipelines
}

export function addPipeline(pipeline: Pipeline): void {
  const data = load()
  data.pipelines.unshift(pipeline)
  save(data)
}

export function deletePipeline(id: string): void {
  const data = load()
  data.pipelines = data.pipelines.filter(p => p.id !== id)
  save(data)
}

export function getChatSessions(): ChatSession[] {
  return load().chatSessions
}

export function getChatSession(id: string): ChatSession | undefined {
  return load().chatSessions.find(s => s.id === id)
}

export function createChatSession(session: ChatSession): void {
  const data = load()
  data.chatSessions.unshift(session)
  save(data)
}

export function updateChatSession(id: string, updates: Partial<ChatSession>): void {
  const data = load()
  data.chatSessions = data.chatSessions.map(s => s.id === id ? { ...s, ...updates } : s)
  save(data)
}

export function deleteChatSession(id: string): void {
  const data = load()
  data.chatSessions = data.chatSessions.filter(s => s.id !== id)
  save(data)
}

export function setUser(user: { email: string; name: string } | null): void {
  const data = load()
  data.user = user
  save(data)
}

export function getUser(): { email: string; name: string } | null {
  return load().user
}
