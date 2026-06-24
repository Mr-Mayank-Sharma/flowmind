"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Folder, File, FileCode, FileImage, FileText, ChevronRight, ChevronDown, Download, Trash2, Plus, ExternalLink, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileEntry {
  name: string
  type: "file" | "directory"
  size?: string
  modified?: string
  lang?: string
  icon?: string
}

interface Directory {
  name: string
  path: string
  children: Directory[]
}

const directoryTree: Directory[] = [
  {
    name: "home", path: "/home", children: [
      {
        name: "flowmind", path: "/home/flowmind", children: [
          {
            name: "projects", path: "/home/flowmind/projects", children: [
              { name: "agent-runtime", path: "/home/flowmind/projects/agent-runtime", children: [] },
              { name: "pipeline-engine", path: "/home/flowmind/projects/pipeline-engine", children: [] },
              { name: "web-app", path: "/home/flowmind/projects/web-app", children: [] },
            ],
          },
          {
            name: "models", path: "/home/flowmind/models", children: [
              { name: "ollama", path: "/home/flowmind/models/ollama", children: [] },
              { name: "lm-studio", path: "/home/flowmind/models/lm-studio", children: [] },
            ],
          },
          {
            name: "data", path: "/home/flowmind/data", children: [
              { name: "embeddings", path: "/home/flowmind/data/embeddings", children: [] },
              { name: "context-store", path: "/home/flowmind/data/context-store", children: [] },
            ],
          },
          {
            name: "config", path: "/home/flowmind/config", children: [
              { name: "pipelines", path: "/home/flowmind/config/pipelines", children: [] },
              { name: "agents", path: "/home/flowmind/config/agents", children: [] },
            ],
          },
          { name: "logs", path: "/home/flowmind/logs", children: [] },
        ],
      },
    ],
  },
  { name: "etc", path: "/etc", children: [{ name: "flowmind", path: "/etc/flowmind", children: [] }] },
  { name: "tmp", path: "/tmp", children: [] },
]

const fileIcons: Record<string, string> = {
  ts: "🔵",
  tsx: "⚛️",
  js: "🟡",
  json: "📋",
  md: "📝",
  py: "🐍",
  yaml: "⚙️",
  yml: "⚙️",
  toml: "⚙️",
  css: "🎨",
  html: "🌐",
  sh: "💻",
  log: "📄",
  txt: "📄",
  csv: "📊",
  env: "🔒",
}

const mockFiles: Record<string, FileEntry[]> = {
  "/home/flowmind": [
    { name: "README.md", type: "file", size: "2.3 KB", modified: "2 hours ago" },
    { name: "package.json", type: "file", size: "1.1 KB", modified: "1 day ago" },
    { name: "tsconfig.json", type: "file", size: "0.8 KB", modified: "3 days ago" },
    { name: ".env", type: "file", size: "0.5 KB", modified: "5 days ago" },
    { name: "projects", type: "directory", modified: "2 hours ago" },
    { name: "models", type: "directory", modified: "1 day ago" },
    { name: "data", type: "directory", modified: "3 days ago" },
    { name: "config", type: "directory", modified: "1 week ago" },
    { name: "logs", type: "directory", modified: "2 hours ago" },
  ],
  "/home/flowmind/projects": [
    { name: "agent-runtime", type: "directory", modified: "2 hours ago" },
    { name: "pipeline-engine", type: "directory", modified: "1 day ago" },
    { name: "web-app", type: "directory", modified: "3 days ago" },
    { name: "build.sh", type: "file", size: "0.3 KB", modified: "1 week ago" },
    { name: "docker-compose.yml", type: "file", size: "2.1 KB", modified: "1 week ago" },
  ],
  "/home/flowmind/config": [
    { name: "ollama.yaml", type: "file", size: "1.5 KB", modified: "3 days ago" },
    { name: "pipelines", type: "directory", modified: "5 days ago" },
    { name: "agents", type: "directory", modified: "1 week ago" },
    { name: "flowmind.json", type: "file", size: "3.2 KB", modified: "2 weeks ago" },
  ],
  "/home/flowmind/logs": [
    { name: "ollama.log", type: "file", size: "12.5 MB", modified: "2 min ago" },
    { name: "system.log", type: "file", size: "8.2 MB", modified: "5 min ago" },
    { name: "agent-errors.log", type: "file", size: "0.3 MB", modified: "1 hour ago" },
  ],
}

const codeContent: Record<string, string> = {
  "README.md": `# FlowMind AI Operating System\n\n## Overview\nFlowMind is a next-generation AI orchestration platform that enables you to run, manage, and monitor multiple AI frameworks on your local machine.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Features\n- Multi-framework management\n- Real-time system monitoring\n- Visual pipeline builder\n- Agent runtime`,

  "package.json": `{\n  "name": "flowmind",\n  "version": "0.1.0",\n  "private": true,\n  "scripts": {\n    "dev": "next dev --port 3000",\n    "build": "next build",\n    "start": "next start --port 3000"\n  },\n  "dependencies": {\n    "next": "^14.2.0",\n    "react": "^18.3.0",\n    "lucide-react": "^0.400.0"\n  }\n}`,
}

function findFiles(path: string): FileEntry[] {
  return mockFiles[path] ?? [
    { name: "index.ts", type: "file", size: "1.2 KB", modified: "1 day ago" },
    { name: "utils.ts", type: "file", size: "0.8 KB", modified: "2 days ago" },
  ]
}

function TreeNode({ node, depth, selectedPath, onSelect }: {
  node: Directory
  depth: number
  selectedPath: string
  onSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedPath === node.path

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded)
          onSelect(node.path)
        }}
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded transition-colors text-left",
          isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <span className="w-3" />
        )}
        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("/home/flowmind")
  const [search, setSearch] = useState("")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const files = findFiles(currentPath)
  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))

  const pathParts = currentPath.split("/").filter(Boolean)

  const getFileIcon = (file: FileEntry) => {
    if (file.type === "directory") return <Folder className="h-4 w-4 text-amber-400" />
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    const icon = fileIcons[ext] ?? "📄"
    return <span className="text-sm">{icon}</span>
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
          {directoryTree.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} selectedPath={currentPath} onSelect={setCurrentPath} />
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
                      if (file.type === "directory") {
                        setCurrentPath(`${currentPath}/${file.name}`)
                      } else {
                        setSelectedFile(file.name)
                      }
                    }}
                  >
                    {getFileIcon(file)}
                    <span className="flex-1 text-sm truncate">{file.name}</span>
                    {file.size && <span className="text-xs text-muted-foreground">{file.size}</span>}
                    {file.modified && <span className="text-xs text-muted-foreground w-20 text-right">{file.modified}</span>}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 text-muted-foreground hover:text-foreground" title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1 text-muted-foreground hover:text-red-400" title="Delete">
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
        {selectedFile && codeContent[selectedFile] && (
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
              {codeContent[selectedFile]}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
