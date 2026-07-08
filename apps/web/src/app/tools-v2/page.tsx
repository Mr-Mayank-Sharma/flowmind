"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import {
  Wand2,
  FileCode,
  Search,
  Globe,
  Terminal,
  Edit,
  PenSquare,
  FileText,
  Braces,
  FolderTree,
  Webhook,
  Code,
  Shield,
  Lock,
  Unlock,
  ChevronRight,
  Book,
  Camera,
  History,
  Layers,
  Cpu,
  Puzzle,
  Play,
  Trash2,
  RotateCcw,
} from "lucide-react"

const toolIcons: Record<string, any> = {
  edit: Edit,
  write: PenSquare,
  read: FileText,
  grep: Search,
  glob: FolderTree,
  bash: Terminal,
  websearch: Globe,
  webfetch: Webhook,
  apply_patch: FileCode,
  todowrite: Braces,
}

export default function ToolsV2Page() {
  const [tools, setTools] = useState<any[]>([])
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [toolArgs, setToolArgs] = useState("{}")
  const [toolResult, setToolResult] = useState<string | null>(null)

  const [permissionRules, setPermissionRules] = useState<any[]>([])
  const [newPermRule, setNewPermRule] = useState({ permission: "", pattern: "*", action: "ask" })

  const [lspFile, setLspFile] = useState("")
  const [lspLine, setLspLine] = useState("0")
  const [lspCol, setLspCol] = useState("0")
  const [lspResult, setLspResult] = useState<string | null>(null)

  const [snapshotFile, setSnapshotFile] = useState("")
  const [snapshotDesc, setSnapshotDesc] = useState("")
  const [snapshots, setSnapshots] = useState<any[]>([])

  const [sessionId, setSessionId] = useState("")
  const [sessionMessages, setSessionMessages] = useState<any[]>([])
  const [tokenEstimate, setTokenEstimate] = useState<any>(null)

  const [providers, setProviders] = useState<any[]>([])
  const [providerSearch, setProviderSearch] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [providerKey, setProviderKey] = useState("")
  const [selectedProviderId, setSelectedProviderId] = useState("")

  const [plugins, setPlugins] = useState<any[]>([])
  const [pluginDir, setPluginDir] = useState("")

  const [activeTab, setActiveTab] = useState("tools")

  useEffect(() => {
    api.toolsV2.listTools().then(setTools).catch(() => {})
    api.toolsV2.listProviders().then(setProviders).catch(() => {})
    api.toolsV2.listPlugins().then(setPlugins).catch(() => {})
    api.toolsV2.getPermissionRules().then((r) => setPermissionRules(r.rules ?? [])).catch(() => {})
  }, [])

  const executeTool = async () => {
    if (!selectedTool) return
    try {
      const args = JSON.parse(toolArgs)
      const result = await api.toolsV2.executeTool({ toolId: selectedTool, args })
      setToolResult(JSON.stringify(result, null, 2))
    } catch (e: any) {
      setToolResult(`Error: ${e.message}`)
    }
  }

  const addPermissionRule = () => {
    if (!newPermRule.permission) return
    const updated = [...permissionRules, newPermRule]
    setPermissionRules(updated)
    api.toolsV2.updatePermissionRules(updated).catch(() => {})
    setNewPermRule({ permission: "", pattern: "*", action: "ask" })
  }

  const removePermissionRule = (idx: number) => {
    const updated = permissionRules.filter((_, i) => i !== idx)
    setPermissionRules(updated)
    api.toolsV2.updatePermissionRules(updated).catch(() => {})
  }

  const runLspDefinition = async () => {
    try {
      const result = await api.toolsV2.lspGoToDefinition(lspFile, parseInt(lspLine), parseInt(lspCol))
      setLspResult(JSON.stringify(result, null, 2))
    } catch (e: any) {
      setLspResult(`Error: ${e.message}`)
    }
  }

  const runLspReferences = async () => {
    try {
      const result = await api.toolsV2.lspFindReferences(lspFile, parseInt(lspLine), parseInt(lspCol))
      setLspResult(JSON.stringify(result, null, 2))
    } catch (e: any) {
      setLspResult(`Error: ${e.message}`)
    }
  }

  const runLspHover = async () => {
    try {
      const result = await api.toolsV2.lspGetHover(lspFile, parseInt(lspLine), parseInt(lspCol))
      setLspResult(JSON.stringify(result, null, 2))
    } catch (e: any) {
      setLspResult(`Error: ${e.message}`)
    }
  }

  const createSnapshot = async () => {
    try {
      await api.toolsV2.snapshotCreate(snapshotFile, snapshotDesc || undefined)
      setSnapshotDesc("")
    } catch (e: any) {
      setLspResult(`Error: ${e.message}`)
    }
  }

  const loadSnapshots = async () => {
    try {
      const list = await api.toolsV2.snapshotHistory(snapshotFile || undefined)
      setSnapshots(list ?? [])
    } catch (e: any) {
      setLspResult(`Error: ${e.message}`)
    }
  }

  const compactSession = async () => {
    try {
      const result = await api.toolsV2.sessionCompact(sessionId)
      setToolResult(JSON.stringify(result, null, 2))
    } catch (e: any) {
      setToolResult(`Error: ${e.message}`)
    }
  }

  const estimateTokens = async () => {
    try {
      const result = await api.toolsV2.sessionEstimateTokens(sessionId)
      setTokenEstimate(result)
    } catch (e: any) {
      setTokenEstimate({ error: e.message })
    }
  }

  const searchModels = async () => {
    if (!providerSearch) return
    try {
      const results = await api.toolsV2.searchModels(providerSearch)
      setSearchResults(results ?? [])
    } catch (e: any) {
      setSearchResults([])
    }
  }

  const setApiKey = async () => {
    if (!selectedProviderId || !providerKey) return
    try {
      await api.toolsV2.setProviderKey(selectedProviderId, providerKey)
      setProviderKey("")
    } catch (e: any) {
      setToolResult(`Error: ${e.message}`)
    }
  }

  const loadPluginDir = async () => {
    if (!pluginDir) return
    try {
      await api.toolsV2.loadPluginDir(pluginDir)
      const list = await api.toolsV2.listPlugins()
      setPlugins(list ?? [])
    } catch (e: any) {
      setToolResult(`Error: ${e.message}`)
    }
  }

  const currentTool = tools.find((t) => t.id === selectedTool)

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Developer Tools</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Advanced tooling, permissions, LSP, snapshots, and provider management
              </p>
            </div>
            <Badge variant="secondary" className="text-xs gap-1">
              <Wand2 className="h-3 w-3" />
              {tools.length} tools registered
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="tools" className="gap-1.5 text-xs">
              <Wand2 className="h-3.5 w-3.5" /> Tools
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" /> Permissions
            </TabsTrigger>
            <TabsTrigger value="lsp" className="gap-1.5 text-xs">
              <Code className="h-3.5 w-3.5" /> LSP
            </TabsTrigger>
            <TabsTrigger value="snapshots" className="gap-1.5 text-xs">
              <Camera className="h-3.5 w-3.5" /> Snapshots
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="providers" className="gap-1.5 text-xs">
              <Cpu className="h-3.5 w-3.5" /> Providers
            </TabsTrigger>
            <TabsTrigger value="plugins" className="gap-1.5 text-xs">
              <Puzzle className="h-3.5 w-3.5" /> Plugins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className={cn(!selectedTool && "xl:col-span-3")}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {tools.map((tool) => {
                    const Icon = toolIcons[tool.id] || Terminal
                    return (
                      <button key={tool.id} onClick={() => { setSelectedTool(tool.id); setToolResult(null) }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center",
                          selectedTool === tool.id
                            ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50 bg-surface card-hover"
                        )}
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-xs font-medium">{tool.id}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-2">{tool.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedTool && (
                <div className="space-y-4 xl:col-span-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        {(() => { const Icon = toolIcons[selectedTool] || Terminal; return <Icon className="h-5 w-5 text-primary" /> })()}
                        <div>
                          <CardTitle className="text-sm">{selectedTool}</CardTitle>
                          <CardDescription className="text-xs">{currentTool?.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Arguments (JSON)</label>
                        <textarea value={toolArgs} onChange={(e) => setToolArgs(e.target.value)}
                          className="w-full h-28 text-xs font-mono p-3 rounded-lg border border-border/50 bg-background/50 resize-none"
                        />
                      </div>
                      <Button onClick={executeTool} size="sm" className="h-8 text-xs gap-1.5">
                        <Play className="h-3.5 w-3.5" /> Execute
                      </Button>
                      {toolResult && (
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Result</label>
                          <pre className="w-full text-xs font-mono p-3 rounded-lg border border-border/50 bg-background/50 overflow-auto max-h-60 whitespace-pre-wrap">
                            {toolResult}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Permission Rules
                  </CardTitle>
                  <CardDescription className="text-xs">Configure allow/ask/deny rules for tool execution</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Permission</label>
                      <Input placeholder="e.g. edit, read, *" value={newPermRule.permission}
                        onChange={(e) => setNewPermRule({ ...newPermRule, permission: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Pattern</label>
                      <Input placeholder="*" value={newPermRule.pattern}
                        onChange={(e) => setNewPermRule({ ...newPermRule, pattern: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Action</label>
                      <Select value={newPermRule.action} onValueChange={(v) => setNewPermRule({ ...newPermRule, action: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="allow" className="text-xs">Allow</SelectItem>
                          <SelectItem value="ask" className="text-xs">Ask</SelectItem>
                          <SelectItem value="deny" className="text-xs">Deny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addPermissionRule} size="sm" className="h-8 text-xs">Add</Button>
                  </div>
                  <Separator />
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {permissionRules.length === 0 && (
                      <p className="text-xs text-muted-foreground py-4 text-center">No permission rules configured</p>
                    )}
                    {permissionRules.map((rule, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3 text-xs">
                          <Badge className={cn("text-[10px]",
                            rule.action === "allow" ? "bg-emerald-500/10 text-emerald-400" :
                            rule.action === "deny" ? "bg-red-500/10 text-red-400" :
                            "bg-amber-500/10 text-amber-400"
                          )}>{rule.action}</Badge>
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{rule.permission}</code>
                          <span className="text-muted-foreground">→</span>
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{rule.pattern}</code>
                        </div>
                        <button onClick={() => removePermissionRule(i)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Access Control
                  </CardTitle>
                  <CardDescription className="text-xs">Tools are evaluated against permission rules at runtime</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {["edit", "read", "write", "bash", "websearch"].map((toolName) => {
                      const rule = permissionRules.filter((r) => {
                        return r.permission === "*" || r.permission === toolName
                      }).pop()
                      const action = rule?.action ?? "ask"
                      const Icon = toolIcons[toolName] || Terminal
                      return (
                        <div key={toolName} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium capitalize">{toolName}</span>
                          </div>
                          <Badge className={cn("text-[10px]",
                            action === "allow" ? "bg-emerald-500/10 text-emerald-400" :
                            action === "deny" ? "bg-red-500/10 text-red-400" :
                            "bg-amber-500/10 text-amber-400"
                          )}>{action}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="lsp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code className="h-4 w-4" /> Language Server Protocol
                </CardTitle>
                <CardDescription className="text-xs">
                  Go to definition, find references, and hover information for TypeScript, Python, Go, Rust, CSS, HTML, JSON
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] text-muted-foreground">File Path</label>
                    <Input placeholder="/path/to/file.ts" value={lspFile}
                      onChange={(e) => setLspFile(e.target.value)} className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Line</label>
                    <Input type="number" placeholder="0" value={lspLine}
                      onChange={(e) => setLspLine(e.target.value)} className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Column</label>
                    <Input type="number" placeholder="0" value={lspCol}
                      onChange={(e) => setLspCol(e.target.value)} className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={runLspDefinition} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <ChevronRight className="h-3 w-3" /> Go to Definition
                  </Button>
                  <Button onClick={runLspReferences} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Search className="h-3 w-3" /> Find References
                  </Button>
                  <Button onClick={runLspHover} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Book className="h-3 w-3" /> Hover
                  </Button>
                </div>
                {lspResult && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Result</label>
                    <pre className="w-full text-xs font-mono p-3 rounded-lg border border-border/50 bg-background/50 overflow-auto max-h-48 whitespace-pre-wrap">
                      {lspResult}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="snapshots" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Create Snapshot
                  </CardTitle>
                  <CardDescription className="text-xs">Capture file state to allow rollback</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">File Path (optional — blank for all tracked files)</label>
                    <Input placeholder="/path/to/file.ts" value={snapshotFile}
                      onChange={(e) => setSnapshotFile(e.target.value)} className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Description</label>
                    <Input placeholder="Before refactoring" value={snapshotDesc}
                      onChange={(e) => setSnapshotDesc(e.target.value)} className="h-8 text-xs"
                    />
                  </div>
                  <Button onClick={createSnapshot} size="sm" className="h-8 text-xs gap-1.5">
                    <Camera className="h-3.5 w-3.5" /> Create Snapshot
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" /> Snapshot History
                  </CardTitle>
                  <CardDescription className="text-xs">Restore or view previous snapshots</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={loadSnapshots} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <History className="h-3.5 w-3.5" /> Load Snapshots
                  </Button>
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {snapshots.length === 0 && (
                      <p className="text-xs text-muted-foreground py-4 text-center">No snapshots found</p>
                    )}
                    {snapshots.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                        <div className="text-xs">
                          <p className="font-medium">{s.description ?? "Untitled"}</p>
                          <p className="text-muted-foreground text-[10px]">
                            {new Date(s.timestamp).toLocaleString()} — {s.files?.length ?? 0} files
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={async () => {
                              try {
                                await api.toolsV2.snapshotRestore(s.id)
                                loadSnapshots()
                              } catch {}
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Session Engine
                </CardTitle>
                <CardDescription className="text-xs">Compress, estimate tokens, and manage chat sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Session ID</label>
                  <Input placeholder="session_xxx" value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)} className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={compactSession} size="sm" className="h-8 text-xs gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Compact Session
                  </Button>
                  <Button onClick={estimateTokens} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Estimate Tokens
                  </Button>
                  <Button onClick={async () => {
                    try {
                      await api.toolsV2.sessionClear(sessionId)
                    } catch {}
                  }} variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </Button>
                </div>
                {tokenEstimate && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(tokenEstimate).map(([key, val]) => (
                      <div key={key} className="p-3 rounded-lg bg-muted/20">
                        <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                        <p className="text-lg font-bold">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> Provider Registry
                  </CardTitle>
                  <CardDescription className="text-xs">11 providers with 20+ models available</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-80 overflow-auto">
                  {providers.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No providers loaded</p>
                  )}
                  {providers.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-primary">{p.name?.[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.models?.length ?? 0} models</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{p.id}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="h-4 w-4" /> Model Search & Keys
                  </CardTitle>
                  <CardDescription className="text-xs">Search models across providers or set API keys</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Search models</label>
                      <Input placeholder="gpt, claude, llama..." value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)} className="h-8 text-xs"
                      />
                    </div>
                    <Button onClick={searchModels} size="sm" className="h-8 text-xs">Search</Button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="max-h-32 overflow-auto space-y-1">
                      {searchResults.map((m: any, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20 text-xs">
                          <span className="font-medium">{m.id}</span>
                          <span className="text-muted-foreground">{m.provider}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Provider</label>
                      <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select provider" /></SelectTrigger>
                        <SelectContent>
                          {providers.map((p: any) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">API Key</label>
                      <Input type="password" placeholder="sk-..." value={providerKey}
                        onChange={(e) => setProviderKey(e.target.value)} className="h-8 text-xs"
                      />
                    </div>
                    <Button onClick={setApiKey} size="sm" className="h-8 text-xs">Set</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plugins" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Puzzle className="h-4 w-4" /> Plugins
                  </CardTitle>
                  <CardDescription className="text-xs">Load and manage tool plugins</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Plugin directory</label>
                      <Input placeholder="/path/to/plugins" value={pluginDir}
                        onChange={(e) => setPluginDir(e.target.value)} className="h-8 text-xs font-mono"
                      />
                    </div>
                    <Button onClick={loadPluginDir} size="sm" className="h-8 text-xs gap-1.5">
                      <Puzzle className="h-3.5 w-3.5" /> Load
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {plugins.length === 0 && (
                      <p className="text-xs text-muted-foreground py-4 text-center">No plugins loaded</p>
                    )}
                    {plugins.map((p: any, i) => (
                      <div key={p.name ?? i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                            <Puzzle className="h-3 w-3 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-medium">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.tools?.length ?? 0} tools</p>
                          </div>
                        </div>
                        {p.hooks && <Badge variant="secondary" className="text-[10px]">{p.hooks.length} hooks</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
