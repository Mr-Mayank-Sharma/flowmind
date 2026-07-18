"use client"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Check, X, Clock } from "lucide-react"
import { api } from "@/lib/api"
import { useQuery, useMutation } from "@/hooks/use-query"
import { Skeleton } from "@/components/ui/skeleton"

export function CronJobsTab() {
  const { data: cronList = [], loading, refetch } = useQuery(
    "settings:cron",
    () => api.jobs.list(),
  )

  const { mutate: toggleJob } = useMutation(
    (id: string) => api.jobs.toggle(id),
    { onSuccess: refetch },
  )

  const { mutate: deleteJob } = useMutation(
    (id: string) => api.jobs.delete(id),
    { onSuccess: refetch },
  )

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Jobs</CardTitle>
              <CardDescription>Automate pipeline execution on a schedule</CardDescription>
            </div>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" />Create Job</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-3 py-4">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3"><Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-48" /></div></div>))}</div>
          ) : cronList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scheduled jobs yet</p>
          ) : cronList.map((job: any) => (
            <div key={job.id} className="flex items-center gap-4 rounded-lg border bg-surface px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                job.isActive ? "bg-green-500" : "bg-amber-500"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{job.name}</p>
                  <Badge variant={job.isActive ? "default" : "secondary"} className="text-xs">
                    {job.isActive ? "active" : "paused"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Schedule: <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.expression}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Last run: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "Never"} &middot; {job.runCount ?? 0} runs
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toggleJob(job.id)}>
                  {job.isActive ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  {job.isActive ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"><Clock className="h-3 w-3" />Edit</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteJob(job.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
