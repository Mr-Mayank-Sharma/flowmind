"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Search, Book, Upload, FileText, Trash2, ExternalLink, Database, Search as SearchIcon, Loader2, CheckCircle, XCircle, Download, File, FileJson, Table2, FileSpreadsheet, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"

const typeIcons: Record<string, React.ElementType> = { pdf: FileText, txt: File, md: FileText, csv: Table2, json: FileJson }

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<"browse" | "search" | "upload">("browse")
  const [selectedKB, setSelectedKB] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newKB, setNewKB] = useState({ name: "", description: "" })

  const { data: kbs = [], loading: kbsLoading, refetch: refetchKBs } = useQuery(
    "knowledge:list",
    () => api.knowledge.list(),
  )

  const { data: currentKB, loading: kbLoading } = useQuery(
    selectedKB ? `knowledge:getById:${selectedKB}` : null,
    () => api.knowledge.getById(selectedKB!),
    { enabled: !!selectedKB },
  )

  const { data: searchResults = [], loading: searching, refetch: doSearch } = useQuery(
    searchQuery ? `knowledge:search:${searchQuery}` : null,
    () => api.knowledge.search(searchQuery),
    { enabled: false },
  )

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    doSearch()
  }

  const { mutate: createKB } = useMutation(
    (input: { name: string; description?: string }) => api.knowledge.create(input),
    { onSuccess: () => { setShowCreate(false); setNewKB({ name: "", description: "" }); refetchKBs() } },
  )

  const { mutate: deleteKB } = useMutation(
    (id: string) => api.knowledge.delete(id),
    { onSuccess: () => { setSelectedKB(null); refetchKBs() } },
  )

  const { mutate: deleteDoc } = useMutation(
    (id: string) => api.knowledge.deleteDocument(id),
    { onSuccess: refetchKBs },
  )

  const docs = currentKB?.documents ?? []

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Knowledge Base</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Store, index, and search documents for RAG-powered agents</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                {(["browse", "search", "upload"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn("px-3 py-1.5 text-xs rounded-md transition-colors font-medium", activeTab === tab ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  >{tab === "browse" ? "Browse" : tab === "search" ? "Search" : "Upload"}</button>
                ))}
              </div>
              {activeTab === "browse" && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCreate(!showCreate)}>
                  <Plus className="h-3 w-3" /> New KB
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {activeTab === "browse" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold mb-3">Knowledge Bases</h2>

              {showCreate && (
                <Card className="p-4 border-primary/30 bg-primary/[0.02]">
                  <h3 className="text-sm font-semibold mb-3">Create Knowledge Base</h3>
                  <div className="space-y-3">
                    <Input value={newKB.name} onChange={(e) => setNewKB({ ...newKB, name: e.target.value })} placeholder="Knowledge base name" className="h-8 text-sm" />
                    <Input value={newKB.description} onChange={(e) => setNewKB({ ...newKB, description: e.target.value })} placeholder="Description (optional)" className="h-8 text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs" onClick={() => createKB(newKB)} disabled={!newKB.name}>Create</Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
                    </div>
                  </div>
                </Card>
              )}

              {kbsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : kbs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No knowledge bases yet. Create one to get started.</p>
              ) : kbs.map((kb: any) => (
                <div key={kb.id}
                  className={cn("rounded-lg border border-border/50 bg-surface p-4 transition-all cursor-pointer card-hover", selectedKB === kb.id && "ring-1 ring-primary/30")}
                  onClick={() => setSelectedKB(selectedKB === kb.id ? null : kb.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Database className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{kb.name}</h3>
                        <p className="text-xs text-muted-foreground">{kb.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[10px]", kb.status === "READY" ? "bg-emerald-500/10 text-emerald-400" : kb.status === "INDEXING" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400")}>
                        {kb.status === "READY" ? "Ready" : kb.status === "INDEXING" ? "Indexing..." : "Error"}
                      </Badge>
                      <button onClick={(e) => { e.stopPropagation(); deleteKB(kb.id) }} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span>{kb.totalDocs} documents</span>
                    <span>{kb.totalChunks.toLocaleString()} chunks</span>
                    <span>{kb.totalSize ? `${(Number(kb.totalSize) / 1_000_000).toFixed(1)} MB` : "0 MB"}</span>
                    <span className="ml-auto">{new Date(kb.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedKB && currentKB && (
              <div className="space-y-4">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-3">{currentKB.name} — Documents</h3>
                  <div className="space-y-2">
                    {docs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No documents yet</p>
                    ) : docs.map((doc: any) => {
                      const typeLower = doc.type.toLowerCase()
                      const DocIcon = (typeIcons as Record<string, React.ElementType>)[typeLower] || File
                      return (
                        <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-background/30 hover:bg-accent/20 transition-colors">
                          <DocIcon className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{doc.name}</p>
                            <p className="text-[10px] text-muted-foreground">{doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : "0 KB"} · {doc.chunks} chunks</p>
                          </div>
                          <Badge className={cn("text-[10px]", doc.status === "INDEXED" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                            {doc.status === "INDEXED" ? "indexed" : "indexing"}
                          </Badge>
                          <button onClick={() => deleteDoc(doc.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full" onClick={() => setActiveTab("upload")}>
                      <Upload className="h-3 w-3" /> Upload Document
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across all knowledge bases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 h-11 text-sm"
              />
              <Button size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 text-xs" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <SearchIcon className="h-3 w-3" />}
                Search
              </Button>
            </div>

            {searching && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching knowledge bases...
              </div>
            )}

            {searchResults.length > 0 && !searching && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{searchResults.length} results</p>
                {searchResults.map((r: any) => (
                  <div key={r.id} className="rounded-lg border border-border/50 bg-surface p-4 hover:bg-accent/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{r.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">{r.kb}</Badge>
                          <span>{r.doc}</span>
                          <span className="font-mono ml-auto">{(r.score * 100).toFixed(0)}% match</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="max-w-lg mx-auto">
            <Card className="p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Upload Documents</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Drag and drop files here, or click to browse. Supports PDF, TXT, MD, CSV, JSON.
                </p>
                <div className="w-full border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Drop files here</p>
                </div>
                <Button className="w-full gap-2">
                  <Upload className="h-4 w-4" /> Upload & Index
                </Button>
                <p className="text-[10px] text-muted-foreground">Max file size: 50 MB per file</p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
