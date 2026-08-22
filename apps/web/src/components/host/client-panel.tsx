"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Plug,
  Loader2,
  LogOut,
  RefreshCw,
  GitBranch,
  Book,
  Wrench,
  Send,
  Search,
  FilePlus2,
  Copy,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/hooks/use-toast"
import { API_URL, hostClientApi } from "@/lib/api"

const STORAGE_KEY = "flowmind_host_client"

interface Session {
  hostUrl: string
  token: string
  clientId: string
  groupId: string
  groupName: string
}

interface PullResult {
  groupId: string
  syncedAt: string
  pipelines: any[]
  skills: any[]
  knowledge: any[]
}

function loadSession(): Session | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function ClientPanel() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const [session, setSession] = useState<Session | null>(null)

  const [hostUrl, setHostUrl] = useState(API_URL)
  const [connectToken, setConnectToken] = useState("")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [connecting, setConnecting] = useState(false)

  const [pull, setPull] = useState<PullResult | null>(null)
  const [pullLoading, setPullLoading] = useState(false)

  const [proposeBase, setProposeBase] = useState("")
  const [proposeName, setProposeName] = useState("")
  const [proposeMessage, setProposeMessage] = useState("")
  const [proposeGraph, setProposeGraph] = useState("")
  const [proposing, setProposing] = useState(false)

  const [searchText, setSearchText] = useState("")
  const [chunks, setChunks] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("tinyllama")
  const [inference, setInference] = useState<{ content: string; model: string; modelResolved?: boolean } | null>(null)
  const [inferring, setInferring] = useState(false)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const s = loadSession()
    if (s) {
      setSession(s)
      setHostUrl(s.hostUrl)
    }
  }, [])

  const connect = async () => {
    if (!connectToken.trim() || !email.trim()) {
      toastError("Missing fields", "Enter a connect token and email")
      return
    }
    setConnecting(true)
    try {
      const res = await hostClientApi(hostUrl, connectToken.trim()).connect({
        token: connectToken.trim(),
        email: email.trim(),
        name: name.trim() || undefined,
        url: API_URL,
      })
      const s: Session = { hostUrl, token: res.hostClientToken, clientId: res.clientId, groupId: res.groupId, groupName: res.groupName }
      setSession(s)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      toastSuccess("Connected", `Joined ${res.groupName} on the host`)
      setConnectToken("")
      await pullResources(s)
    } catch (e: any) {
      toastError("Connection failed", e?.message)
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = () => {
    setSession(null)
    setPull(null)
    setChunks([])
    setInference(null)
    localStorage.removeItem(STORAGE_KEY)
    toastInfo("Disconnected")
  }

  const pullResources = async (s: Session) => {
    setPullLoading(true)
    try {
      const res = await hostClientApi(s.hostUrl, s.token).pull()
      setPull(res)
      if (!proposeBase && res.pipelines[0]) setProposeBase(res.pipelines[0].id)
      return res
    } catch (e: any) {
      toastError("Pull failed", e?.message)
    } finally {
      setPullLoading(false)
    }
  }

  const searchContext = async () => {
    if (!searchText.trim() || !session) return
    setSearching(true)
    try {
      const res = await hostClientApi(session.hostUrl, session.token).searchContext({ text: searchText.trim(), topK: 5 })
      setChunks(res.chunks ?? [])
    } catch (e: any) {
      toastError("Search failed", e?.message)
    } finally {
      setSearching(false)
    }
  }

  const runInference = async () => {
    if (!prompt.trim() || !session) return
    setInferring(true)
    try {
      const res = await hostClientApi(session.hostUrl, session.token).routeInference({ model, prompt: prompt.trim() })
      setInference(res)
    } catch (e: any) {
      toastError("Inference failed", e?.message)
    } finally {
      setInferring(false)
    }
  }

  const selectBase = (id: string) => {
    setProposeBase(id)
    const p = pull?.pipelines.find((x) => x.id === id)
    if (p) {
      setProposeName(`Update ${p.name}`)
      setProposeGraph(JSON.stringify(p.graph ?? { nodes: [], edges: [] }, null, 2))
    }
  }

  const propose = async () => {
    if (!session || !proposeBase || !proposeName.trim()) return
    let graph: any
    try {
      graph = JSON.parse(proposeGraph)
    } catch {
      toastError("Invalid graph JSON", "Fix the proposed graph before submitting")
      return
    }
    setProposing(true)
    try {
      const res = await hostClientApi(session.hostUrl, session.token).proposePipeline({
        basePipelineId: proposeBase,
        name: proposeName.trim(),
        proposedGraph: graph,
        message: proposeMessage.trim() || undefined,
      })
      toastSuccess("Proposal submitted", `Waiting for host review (${res.status ?? "PROPOSED"})`)
    } catch (e: any) {
      toastError("Proposal failed", e?.message)
    } finally {
      setProposing(false)
    }
  }

  const copyHostClientToken = async () => {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toastError("Copy failed")
    }
  }

  if (!session) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              Connect to a host
            </CardTitle>
            <CardDescription>
              Exchange a connect token for a host-client credential. You receive group-scoped pipelines, skills, and RAG access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Host URL</label>
              <Input value={hostUrl} onChange={(e) => setHostUrl(e.target.value)} placeholder="http://host:3001" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Connect token</label>
              <Input value={connectToken} onChange={(e) => setConnectToken(e.target.value)} placeholder="Paste the one-time token" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Your email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Client name (optional)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="branch-office-1" />
            </div>
            <Button onClick={connect} disabled={connecting} className="w-full gap-2">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Connect
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. On the Groups tab, generate a connect token for a group.</p>
            <p>2. Paste it here with your email and connect.</p>
            <p>3. Pull the shared pipelines, skills, and knowledge — all scoped to that group.</p>
            <p>4. Route inference through the host model.</p>
            <p>5. Propose pipeline changes. Host owners approve and merge them (diff â†’ merge, version bump).</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Plug className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-medium text-foreground">Connected to {session.hostUrl}</p>
              <p className="text-xs text-muted-foreground">
                Group: <span className="font-medium text-foreground">{session.groupName}</span> Â· client {session.clientId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyHostClientToken} className="gap-2">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy client token
            </Button>
            <Button variant="outline" size="sm" onClick={disconnect} className="gap-2">
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              Group resources
            </CardTitle>
            <CardDescription>Canonical pipelines, skills, and RAG knowledge published by the host for this group.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => pullResources(session)} disabled={pullLoading} className="gap-2">
            {pullLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync
          </Button>
        </CardHeader>
        <CardContent>
          {!pull ? (
            <EmptyState
              title="Not synced yet"
              description="Click Sync to pull the group's pipelines, skills, and knowledge."
              action={{ label: "Sync now", onClick: () => pullResources(session) }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <GitBranch className="h-3.5 w-3.5" />Pipelines ({pull.pipelines.length})
                </p>
                <div className="space-y-2">
                  {pull.pipelines.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectBase(p.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                        proposeBase === p.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block font-medium text-foreground">{p.name}</span>
                      <span className="block text-[10px] text-muted-foreground">v{p.version} Â· {p.id}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />Skills ({pull.skills.length})
                </p>
                <div className="space-y-2">
                  {pull.skills.map((s) => (
                    <div key={s.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                      <span className="block font-medium text-foreground">{s.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{s.triggerPattern ?? "no trigger"}</span>
                    </div>
                  ))}
                  {pull.skills.length === 0 && <p className="text-xs text-muted-foreground">No skills published.</p>}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Book className="h-3.5 w-3.5" />Knowledge ({pull.knowledge.length})
                </p>
                <div className="space-y-2">
                  {pull.knowledge.map((k) => (
                    <div key={k.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                      <span className="block font-medium text-foreground">{k.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{k.totalDocs ?? 0} docs</span>
                    </div>
                  ))}
                  {pull.knowledge.length === 0 && <p className="text-xs text-muted-foreground">No knowledge indexed.</p>}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Search group context
            </CardTitle>
            <CardDescription>RAG retrieval scoped to this group&apos;s knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ask the group knowledge base…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchContext()}
              />
              <Button size="sm" onClick={searchContext} disabled={searching || !searchText.trim()} className="gap-2">
                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {chunks.length > 0 && (
              <div className="space-y-2">
                {chunks.map((c, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <span className="mb-1 block font-mono text-[10px] text-primary">
                      {(c as any).docId ?? (c as any).metadata?.docId ?? "chunk"} Â· score {((c as any).score ?? 0).toFixed(3)}
                    </span>
                    {(c as any).content ?? (c as any).text}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Route inference to host model
            </CardTitle>
            <CardDescription>The host serves the shared Ollama model; requested models fall back to an installed local one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={model} onChange={(e) => setModel(e.target.value)} className="w-40" placeholder="model" />
              <Input
                placeholder="Prompt…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runInference()}
              />
              <Button size="sm" onClick={runInference} disabled={inferring || !prompt.trim()} className="gap-2">
                {inferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {inference && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{inference.model}</Badge>
                  {inference.modelResolved && (
                    <Badge className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]">resolved fallback</Badge>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{inference.content}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 text-primary" />
            Propose pipeline change
          </CardTitle>
          <CardDescription>
            Edit the base graph and submit a proposal. The host reviews, approves, and merges it with a diff + version bump.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Base pipeline</span>
            <select
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={proposeBase}
              onChange={(e) => selectBase(e.target.value)}
            >
              <option value="">Select a base pipeline…</option>
              {(pull?.pipelines ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>
              ))}
            </select>
          </div>
          <Input placeholder="Proposal name (e.g. Update Review Flow)" value={proposeName} onChange={(e) => setProposeName(e.target.value)} />
          <Input placeholder="Message to reviewers (optional)" value={proposeMessage} onChange={(e) => setProposeMessage(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Proposed graph (JSON)</label>
            <textarea
              className="h-48 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              value={proposeGraph}
              onChange={(e) => setProposeGraph(e.target.value)}
              spellCheck={false}
            />
          </div>
          <Button onClick={propose} disabled={proposing || !proposeBase || !proposeName.trim()} className="gap-2">
            {proposing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
            Submit proposal
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}


