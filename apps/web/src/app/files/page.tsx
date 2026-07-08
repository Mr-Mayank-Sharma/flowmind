"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Folder, File, FileCode, FileText, ChevronRight, Trash2, Plus, Download, ExternalLink, Terminal, FileJson, Table2, Lock, FileType, Terminal as TerminalIcon, Brush } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

const fileIconMap: Record<string, React.ElementType> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  json: FileJson,
  md: FileText,
  py: TerminalIcon,
  yaml: FileType,
  yml: FileType,
  toml: FileType,
  css: Brush,
  html: FileCode,
  sh: TerminalIcon,
  log: FileText,
  txt: FileText,
  csv: Table2,
  env: Lock,
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return Math.floor(diff / 60000) + " min ago"
  if (diff < 86400000) return Math.floor(diff / 3600000) + " hours ago"
  return Math.floor(diff / 86400000) + " days ago"
}

interface FileEntry {
  name: string
  type: "file" | "folder"
  size?: number
  modifiedAt?: string
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("")
  const [search, setSearch] = useState("")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [files, setFiles] = useState<FileEntry[]>([])
  const [directoryTree, setDirectoryTree] = useState<any[]>([])

  const fetchDir = async (dir: string) => {
    try {
      const result = await api.files.list(dir)
      setFiles(result.children.map((c: any) => ({
        name: c.name,
        type: c.type === "folder" ? "folder" : "file",
        size: c.size,
        modifiedAt: c.modifiedAt,
      })))
    } catch {}
  }

  const fetchRoot = async () => {
    try {
      const result = await api.files.list("/")
      setDirectoryTree(result.children)
    } catch {}
  }

  useEffect(() => {
    fetchRoot()
    fetchDir("")
  }, [])

  useEffect(() => {
    if (currentPath) fetchDir(currentPath)
  }, [currentPath])

  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
  const pathParts = currentPath.split("/").filter(Boolean)

  const getFileIcon = (file: FileEntry) => {
    if (file.type === "folder") return <Folder className="h-4 w-4 text-amber-400" />
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    const Icon = fileIconMap[ext] || File
    return <Icon className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">File Browser</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Browse and manage files in the AI workspace
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Plus className="h-3 w-3" />
                New File
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Download className="h-3 w-3" />
                Upload
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-9.5rem)]">
        {/* Directory Tree */}
        <div className="w-56 shrink-0 border-r border-border/50 bg-surface/50 overflow-y-auto p-2">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1">Filesystem</div>
          {directoryTree.map((node: any) => (
            <div key={node.name}>
              <button
                onClick={() => {
                  const p = currentPath ? `${currentPath}/${node.name}` : `/${node.name}`
                  setCurrentPath(p)
                }}
                className={cn(
                  "flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded transition-colors text-left",
                  "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="truncate">{node.name}</span>
              </button>
            </div>
          ))}
        </div>

        {/* File List */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-surface/30">
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1 text-xs">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <button
                  onClick={() => setCurrentPath("/" + pathParts.slice(0, i + 1).join("/"))}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {part}
                </button>
              </span>
            ))}
            <div className="ml-auto">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Filter files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 text-xs pl-7 w-48"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Folder className="h-8 w-8 mb-2" />
                <p className="text-sm">Empty directory</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredFiles.map((file) => (
                  <div
                    key={file.name}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors cursor-pointer group",
                      selectedFile === file.name && "bg-accent/30"
                    )}
                    onClick={() => {
                      if (file.type === "folder") {
                        setCurrentPath(`${currentPath}/${file.name}`)
                      } else {
                        setSelectedFile(file.name)
                        api.files.read(`${currentPath}/${file.name}`).then((r) => {
                          setFileContent(r.content || "No preview available")
                        }).catch(() => setFileContent("Error reading file"))
                      }
                    }}
                  >
                    {getFileIcon(file)}
                    <span className="flex-1 text-sm truncate">{file.name}</span>
                    {file.size != null && <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>}
                    {file.modifiedAt && <span className="text-xs text-muted-foreground w-20 text-right">{formatTime(file.modifiedAt)}</span>}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 text-muted-foreground hover:text-red-400" title="Delete" onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await api.files.delete(`${currentPath}/${file.name}`)
                          fetchDir(currentPath)
                        } catch {}
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Code Viewer */}
        {selectedFile && fileContent && (
          <div className="w-96 shrink-0 border-l border-border/50 bg-background/80 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
              <div className="flex items-center gap-2 text-xs font-medium">
                <FileCode className="h-3.5 w-3.5" />
                {selectedFile}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1 text-muted-foreground hover:text-foreground" title="Open in terminal">
                  <Terminal className="h-3.5 w-3.5" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground" title="Open externally">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs font-mono leading-5 text-foreground/80 overflow-x-auto">
              {fileContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
