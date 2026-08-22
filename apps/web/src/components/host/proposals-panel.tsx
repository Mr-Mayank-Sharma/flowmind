"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Check, X, GitMerge, Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/hooks/use-toast"
import { api, type PipelineProposal } from "@/lib/api"

const statusColor: Record<string, string> = {
  PROPOSED: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  APPROVED: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  REJECTED: "text-red-500 border-red-500/30 bg-red-500/10",
  MERGED: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
}

type Filter = "PROPOSED" | "APPROVED" | "REJECTED" | "MERGED" | "ALL"

export function ProposalsPanel() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<PipelineProposal[]>([])
  const [filter, setFilter] = useState<Filter>("ALL")
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.host.listProposals(filter === "ALL" ? {} : { status: filter, limit: 100 })
      setProposals(res.proposals)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load proposals")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const run = async (label: string, id: string, fn: () => Promise<any>, successMsg: string) => {
    setBusy(id)
    try {
      await fn()
      toastSuccess(label, successMsg)
      await load()
    } catch (e: any) {
      toastError(label, e?.message)
    } finally {
      setBusy(null)
    }
  }

  const diffSummary = (p: PipelineProposal) => {
    const d = p.diff
    if (!d) return null
    const parts: string[] = []
    if (d.nodesAdded?.length) parts.push(`+${d.nodesAdded.length} nodes`)
    if (d.nodesRemoved?.length) parts.push(`-${d.nodesRemoved.length} nodes`)
    if (d.nodesModified?.length) parts.push(`~${d.nodesModified.length} modified`)
    if (d.edgesAdded?.length) parts.push(`+${d.edgesAdded.length} edges`)
    if (d.edgesRemoved?.length) parts.push(`-${d.edgesRemoved.length} edges`)
    return parts.length ? parts.join(" Â· ") : "no structural changes"
  }

  const filters: Filter[] = ["ALL", "PROPOSED", "APPROVED", "REJECTED", "MERGED"]

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {proposals.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No proposals"
              description="Proposals appear here when an external client submits a pipeline change against a group."
            />
          </CardContent>
        </Card>
      ) : (
        proposals.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <Badge className={statusColor[p.status] ?? ""}>{p.status}</Badge>
              </div>
              <CardDescription>
                {p.group?.name ?? "—"} · base v{p.baseVersion} · by {p.proposedByName ?? "unknown"} · {new Date(p.createdAt).toLocaleString()}
                {p.comments && p.comments.length > 0 ? ` · ${p.comments.length} comment${p.comments.length > 1 ? "s" : ""}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {p.message && <p className="text-sm text-foreground">{p.message}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="font-mono">{diffSummary(p)}</Badge>
                {p.diff?.nodesModified?.map((n: any) => (
                  <Badge key={n.id ?? n} variant="outline" className="font-mono">~{n.id ?? n}</Badge>
                ))}
              </div>
              {(p.diff?.nodesAdded?.length ?? 0) > 0 && (
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-600 dark:text-emerald-400">
                  Added: {(p.diff.nodesAdded as any[]).map((n: any) => n.id ?? n).join(", ")}
                </div>
              )}
              {(p.diff?.nodesRemoved?.length ?? 0) > 0 && (
                <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
                  Removed: {(p.diff.nodesRemoved as any[]).map((n: any) => n.id ?? n).join(", ")}
                </div>
              )}

              {p.status === "PROPOSED" && (
                <div className="space-y-2">
                  {rejecting[p.id] !== undefined && (
                    <textarea
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Rejection reason…"
                      value={rejecting[p.id] ?? ""}
                      onChange={(e) => setRejecting((r) => ({ ...r, [p.id]: e.target.value }))}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={busy === p.id}
                      onClick={() => run("Approved", p.id, () => api.host.approveProposal(p.id), "Proposal approved")}
                    >
                      {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    {rejecting[p.id] === undefined ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setRejecting((r) => ({ ...r, [p.id]: "" }))}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        disabled={busy === p.id || !rejecting[p.id]?.trim()}
                        onClick={() => {
                          const reason = rejecting[p.id]?.trim()
                          if (!reason) return
                          run("Rejected", p.id, () => api.host.rejectProposal({ id: p.id, reason }), "Proposal rejected")
                          setRejecting((r) => {
                            const next = { ...r }
                            delete next[p.id]
                            return next
                          })
                        }}
                      >
                        Confirm reject
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {p.status === "APPROVED" && (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={busy === p.id}
                  onClick={() => run("Merged", p.id, () => api.host.mergeProposal(p.id), "Proposal merged into base pipeline")}
                >
                  {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                  Merge into base
                </Button>
              )}

              {p.rejectedReason && (
                <p className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {p.rejectedReason}
                </p>
              )}
              {(p.comments?.length ?? 0) > 0 && (
                <div className="space-y-1 border-t border-border pt-2">
                  {p.comments?.map((c) => (
                    <p key={c.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                      <span><span className="text-foreground">{c.authorName ?? c.authorId}</span>: {c.body}</span>
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}


