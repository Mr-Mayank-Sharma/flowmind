"use client"

import { useState, useEffect, useRef } from "react"
import { ScrollArea } from "@flowmind/ui"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Trash2, Pause, Play, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogEntry {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "DEBUG"
  message: string
}

const levelColors: Record<string, string> = {
  INFO: "text-blue-400",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
  DEBUG: "text-muted-foreground",
}

const levelBg: Record<string, string> = {
  INFO: "bg-blue-500/10 border-l-blue-500",
  WARN: "bg-amber-500/10 border-l-amber-500",
  ERROR: "bg-red-500/10 border-l-red-500",
  DEBUG: "bg-transparent border-l-muted-foreground/30",
}

const sampleLogs: Record<string, LogEntry[]> = {
  ollama: [
    { timestamp: "2026-06-24T10:23:01.234Z", level: "INFO", message: "Server started on port 11434" },
    { timestamp: "2026-06-24T10:23:01.456Z", level: "INFO", message: "Model mistral loaded in 2.3s" },
    { timestamp: "2026-06-24T10:23:02.100Z", level: "INFO", message: "Running 3 concurrent requests" },
    { timestamp: "2026-06-24T10:23:05.000Z", level: "WARN", message: "GPU memory usage at 78%" },
    { timestamp: "2026-06-24T10:24:00.000Z", level: "INFO", message: "Request completed: /api/generate (1.2s)" },
    { timestamp: "2026-06-24T10:24:15.000Z", level: "INFO", message: "New connection from 127.0.0.1:54321" },
    { timestamp: "2026-06-24T10:25:00.000Z", level: "DEBUG", message: "Cache hit for model llama3: quantized" },
    { timestamp: "2026-06-24T10:25:30.000Z", level: "WARN", message: "Request queue depth: 5" },
    { timestamp: "2026-06-24T10:26:00.000Z", level: "INFO", message: "Model codellama unloaded (idle)" },
    { timestamp: "2026-06-24T10:26:45.000Z", level: "ERROR", message: "Failed to load model mixtral-8x7b: OOM" },
    { timestamp: "2026-06-24T10:27:00.000Z", level: "INFO", message: "Auto-recovering: freeing cache" },
    { timestamp: "2026-06-24T10:27:15.000Z", level: "INFO", message: "Memory cache cleared: 2.1GB freed" },
  ],
  "lm-studio": [
    { timestamp: "2026-06-24T10:20:00.000Z", level: "INFO", message: "Runtime initialized" },
    { timestamp: "2026-06-24T10:20:01.500Z", level: "INFO", message: "Loading model phi-3-mini" },
    { timestamp: "2026-06-24T10:20:05.000Z", level: "INFO", message: "CUDA detected: 12GB VRAM" },
    { timestamp: "2026-06-24T10:20:06.000Z", level: "INFO", message: "Model phi-3-mini loaded (3.8GB)" },
    { timestamp: "2026-06-24T10:21:00.000Z", level: "DEBUG", message: "Prompt cache initialized: 512MB" },
  ],
}

export function LogViewer({ frameworkId }: { frameworkId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [levelFilter, setLevelFilter] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const [paused, setPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    const initial = sampleLogs[frameworkId] ?? [
      { timestamp: new Date().toISOString(), level: "INFO", message: `${frameworkId} service initialized` },
      { timestamp: new Date().toISOString(), level: "INFO", message: "Waiting for connections..." },
    ]
    setLogs(initial)
  }, [frameworkId])

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      const levels: LogEntry["level"][] = ["INFO", "WARN", "ERROR", "DEBUG"]
      const newEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: levels[Math.floor(Math.random() * 4)]!,
        message: [
          "Request completed in 1.2s",
          "Health check OK",
          "Memory usage: 4.2GB / 16GB",
          "Cache hit ratio: 0.87",
          "New client connected",
          "Model inference: 320ms",
          "Token throughput: 45.2 tok/s",
          "Batch processing: 8 requests",
        ][Math.floor(Math.random() * 8)]!,
      }
      setLogs((prev) => [...prev.slice(-499), newEntry])
    }, 3000)
    return () => clearInterval(interval)
  }, [paused, frameworkId])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, autoScroll])

  const filtered = logs.filter((log) => {
    if (levelFilter !== "ALL" && log.level !== levelFilter) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const clearLogs = () => setLogs([])

  const downloadLogs = () => {
    const blob = new Blob(
      [filtered.map((l) => `[${l.level}] ${l.timestamp} ${l.message}`).join("\n")],
      { type: "text/plain" }
    )
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${frameworkId}-logs.txt`
    a.click()
  }

  return (
    <div className="rounded-lg border border-border/50 bg-background/50">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Output</span>
        <div className="flex items-center gap-1 ml-auto">
          {["ALL", "INFO", "WARN", "ERROR", "DEBUG"].map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors",
                levelFilter === level
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border/50" />
        <button
          onClick={() => setPaused(!paused)}
          className={cn("p-1 rounded transition-colors", paused ? "text-amber-400" : "text-muted-foreground hover:text-foreground")}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        <button onClick={clearLogs} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Clear">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={downloadLogs} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title="Download">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 py-1.5 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Filter logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs pl-7"
          />
        </div>
      </div>
      <ScrollArea className="h-80">
        <div className="p-2 font-mono text-[11px] leading-5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
              No logs match the current filters
            </div>
          ) : (
            filtered.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 px-2 py-0.5 rounded border-l-2 hover:bg-accent/30 transition-colors",
                  levelBg[log.level]
                )}
              >
                <span className="text-[10px] text-muted-foreground shrink-0 w-16">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn("shrink-0 w-10 font-semibold", levelColors[log.level])}>
                  {log.level}
                </span>
                <span className="text-foreground/80">{log.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between px-3 py-1 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">
          {filtered.length} entries{levelFilter !== "ALL" ? ` (filtered: ${levelFilter})` : ""}
        </span>
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-border"
          />
          Auto-scroll
        </label>
      </div>
    </div>
  )
}
