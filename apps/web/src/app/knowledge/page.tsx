"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Search, Book, Upload, FileText, Trash2, ExternalLink, Database, Search as SearchIcon, Loader2, CheckCircle, XCircle, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface KnowledgeBase {
  id: string
  name: string
  description: string
  documents: number
  chunks: number
  size: string
  model: string
  status: "ready" | "indexing" | "error"
  lastUpdated: string
}

interface Document {
  id: string
  name: string
  type: "pdf" | "txt" | "md" | "csv" | "json"
  size: string
  chunks: number
  status: "indexed" | "indexing" | "error"
  uploaded: string
}

const initialKBs: KnowledgeBase[] = [
  { id: "kb1", name: "Product Documentation", description: "User guides, API docs, and release notes", documents: 24, chunks: 3421, size: "48 MB", model: "nomic-embed-text", status: "ready", lastUpdated: "2 hours ago" },
  { id: "kb2", name: "Customer Support KB", description: "Common issues, solutions, and FAQs", documents: 156, chunks: 12890, size: "215 MB", model: "nomic-embed-text", status: "ready", lastUpdated: "1 day ago" },
  { id: "kb3", name: "Code Repository", description: "Source code embeddings for code search", documents: 890, chunks: 45200, size: "890 MB", model: "codellama:7b", status: "indexing", lastUpdated: "Just now" },
  { id: "kb4", name: "Legal Documents", description: "Contracts, terms of service, privacy policy", documents: 12, chunks: 1567, size: "22 MB", model: "nomic-embed-text", status: "ready", lastUpdated: "3 days ago" },
]

const initialDocs: Record<string, Document[]> = {
  "kb1": [
    { id: "d1", name: "getting-started.md", type: "md", size: "12 KB", chunks: 45, status: "indexed", uploaded: "2 hours ago" },
    { id: "d2", name: "api-reference.pdf", type: "pdf", size: "2.3 MB", chunks: 234, status: "indexed", uploaded: "1 day ago" },
    { id: "d3", name: "release-notes-v2.json", type: "json", size: "89 KB", chunks: 12, status: "indexed", uploaded: "3 days ago" },
    { id: "d4", name: "architecture-overview.md", type: "md", size: "45 KB", chunks: 89, status: "indexing", uploaded: "Just now" },
  ],
  "kb2": [
    { id: "d5", name: "faq-common-issues.csv", type: "csv", size: "156 KB", chunks: 345, status: "indexed", uploaded: "1 day ago" },
    { id: "d6", name: "troubleshooting-guide.md", type: "md", size: "28 KB", chunks: 67, status: "indexed", uploaded: "2 days ago" },
  ],
}

const searchResults = [
  { id: "r1", content: "To configure the API key, navigate to Settings > API Keys and click 'Create New Key'", kb: "Product Documentation", score: 0.97, doc: "api-reference.pdf" },
  { id: "r2", content: "The maximum request size is 10 MB. For larger payloads, use the multipart upload endpoint.", kb: "Product Documentation", score: 0.92, doc: "api-reference.pdf" },
  { id: "r3", content: "Our SLA guarantees 99.9% uptime. Credits are issued if uptime falls below this threshold.", kb: "Legal Documents", score: 0.88, doc: "terms-of-service.md" },
  { id: "r4", content: "For password reset issues, verify that the email matches the account on file.", kb: "Customer Support KB", score: 0.85, doc: "faq-common-issues.csv" },
]

const typeIcons: Record<string, string> = { pdf: "📕", txt: "📄", md: "📝", csv: "📊", json: "📋" }

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<"browse" | "search" | "upload">("browse")
  const [selectedKB, setSelectedKB] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults_, setSearchResults] = useState<typeof searchResults>([])

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setTimeout(() => {
      setSearchResults(searchResults.filter((r) => r.content.toLowerCase().includes(searchQuery.toLowerCase())))
      setSearching(false)
    }, 1200)
  }

  const currentKB = selectedKB ? initialKBs.find((kb) => kb.id === selectedKB) : null
  const currentDocs = selectedKB ? (initialDocs[selectedKB] ?? []) : []

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Knowledge Base</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Store, index, and search documents for RAG-powered agents</p>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {(["browse", "search", "upload"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn("px-3 py-1.5 text-xs rounded-md transition-colors font-medium", activeTab === tab ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >{tab === "browse" ? "Browse" : tab === "search" ? "Search" : "Upload"}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {activeTab === "browse" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold mb-3">Knowledge Bases</h2>
              {initialKBs.map((kb) => (
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
                    <Badge className={cn("text-[10px]", kb.status === "ready" ? "bg-emerald-500/10 text-emerald-400" : kb.status === "indexing" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400")}>
                      {kb.status === "ready" ? "Ready" : kb.status === "indexing" ? "Indexing..." : "Error"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span>{kb.documents} documents</span>
                    <span>{kb.chunks.toLocaleString()} chunks</span>
                    <span>{kb.size}</span>
                    <span className="ml-auto">{kb.lastUpdated}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedKB && currentKB && (
              <div className="space-y-4">
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-3">{currentKB.name} — Documents</h3>
                  <div className="space-y-2">
                    {currentDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No documents yet</p>
                    ) : currentDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-background/30 hover:bg-accent/20 transition-colors">
                        <span className="text-lg">{typeIcons[doc.type] ?? "📄"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{doc.name}</p>
                          <p className="text-[10px] text-muted-foreground">{doc.size} · {doc.chunks} chunks</p>
                        </div>
                        <Badge className={cn("text-[10px]", doc.status === "indexed" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                          {doc.status}
                        </Badge>
                        <button className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full">
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

            {searchResults_.length > 0 && !searching && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{searchResults_.length} results</p>
                {searchResults_.map((r) => (
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
                <div className="w-full space-y-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Target Knowledge Base</label>
                  <select className="h-9 text-sm w-full rounded-md border border-input bg-surface px-3">
                    {initialKBs.map((kb) => (<option key={kb.id}>{kb.name}</option>))}
                  </select>
                </div>
                <div className="w-full space-y-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Chunking Strategy</label>
                  <select className="h-9 text-sm w-full rounded-md border border-input bg-surface px-3" defaultValue="fixed">
                    <option value="fixed">Fixed size (512 tokens)</option>
                    <option value="semantic">Semantic chunking</option>
                    <option value="paragraph">By paragraph</option>
                  </select>
                </div>
                <Button className="w-full gap-2" disabled>
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
