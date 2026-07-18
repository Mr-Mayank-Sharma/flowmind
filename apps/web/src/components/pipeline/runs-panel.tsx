"use client"

import { useState, useEffect, useCallback } from "react"
import { ScrollArea, Button } from "@flowmind/ui"
import { X, Clock, CheckCircle, XCircle, Loader2, ChevronRight, RefreshCw } from "lucide-react"
import { Skeleton } from "../ui/skeleton"
import { ErrorState } from "../ui/error-state"
import { api } from "../../lib/api"

interface RunsPanelProps {
  pipelineId: string
  onClose: () => void
}

const statusIcons: Record<string, React.ElementType> = {
  PENDING: Clock,
  RUNNING: Loader2,
  SUCCESS: CheckCircle,
  FAILED: XCircle,
}

const statusColors: Record<string, string> = {
  PENDING: "text-yellow-500",
  RUNNING: "text-blue-500",
  SUCCESS: "text-green-500",
  FAILED: "text-red-500",
}

export function RunsPanel({ pipelineId, onClose }: RunsPanelProps) {
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRun, setSelectedRun] = useState<any | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadRuns = useCallback(async () => {
    try {
      const data = await api.pipeline.getRuns(pipelineId)
      setRuns(data)
      setError(null)
    } catch (err: any) {
      console.error("Failed to load runs:", err)
      setError(err?.message || "Failed to load run history")
    }
  }, [pipelineId])

  useEffect(() => {
    setLoading(true)
    loadRuns().finally(() => setLoading(false))
    const interval = setInterval(loadRuns, 5000)
    return () => clearInterval(interval)
  }, [loadRuns])

  if (error && !loading) {
    return (
      <div className="w-80 h-full bg-surface border-l border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Run History
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null)
            setLoading(true)
            loadRuns().finally(() => setLoading(false))
          }}
        />
      </div>
    )
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadRuns()
    if (selectedRun) {
      try {
        const data = await api.pipeline.getRunLogs(selectedRun.id)
        setLogs(data)
      } catch { /* ignore */ }
    }
    setRefreshing(false)
  }

  const selectRun = async (run: any) => {
    setSelectedRun(run)
    try {
      const data = await api.pipeline.getRunLogs(run.id)
      setLogs(data)
    } catch {
      setLogs([])
    }
  }

  function fmtDuration(durationMs: number): string {
    if (!durationMs || durationMs <= 0) return ""
    if (durationMs < 1000) return `${durationMs}ms`
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
    return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
  }

  return (
    <div className="w-80 h-full bg-surface border-l border flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Run History
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-accent rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-md">
                <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
            <p className="text-xs font-medium text-foreground mb-1">No runs yet</p>
            <p className="text-[10px] text-muted-foreground">Trigger a pipeline to see execution history.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {runs.map((run) => {
              const StatusIcon = statusIcons[run.status] || Clock
              return (
                <div key={run.id}>
                  <button
                    onClick={() => selectRun(run)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs hover:bg-accent transition-colors text-left ${selectedRun?.id === run.id ? "bg-accent" : ""}`}
                  >
                    <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusColors[run.status] || ""} ${run.status === "RUNNING" ? "animate-spin" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground truncate font-medium">{run.status}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}
                      </p>
                      {run.output?.durationMs ? (
                        <p className="text-[10px] text-muted-foreground">{fmtDuration(run.output.durationMs)}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {selectedRun && logs.length > 0 && (
          <div className="border-t mt-2 pt-2 px-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1">
              Node Logs
            </p>
            {logs.map((log) => (
              <div
                key={log.id}
                className="px-2 py-1.5 rounded-md text-[10px] space-y-0.5 hover:bg-accent"
              >
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${log.error ? "bg-red-500" : "bg-green-500"}`} />
                  <span className="font-medium text-foreground truncate">{log.nodeType}</span>
                  {log.duration ? (
                    <span className="text-muted-foreground ml-auto">{fmtDuration(log.duration)}</span>
                  ) : null}
                </div>
                {log.error && (
                  <p className="text-red-500 truncate">{log.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
