"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Search, Clock, Play, Square, RotateCcw, Calendar, ChevronRight, Plus, AlertTriangle, CheckCircle, XCircle, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CronJob {
  id: string
  name: string
  description: string
  schedule: string
  scheduleDesc: string
  target: string
  type: "pipeline" | "agent" | "system"
  status: "active" | "paused" | "error"
  lastRun: string | null
  nextRun: string
  runs: number
  successRate: number
}

interface Run {
  id: string
  jobId: string
  started: string
  duration: string
  status: "success" | "failed" | "running"
  output: string
}

const initialJobs: CronJob[] = [
  { id: "j1", name: "Daily Data Ingestion", description: "Ingest new data from external sources", schedule: "0 3 * * *", scheduleDesc: "Daily at 3:00 AM", target: "Data Ingestion Pipeline", type: "pipeline", status: "active", lastRun: "2026-06-24 03:00", nextRun: "2026-06-25 03:00", runs: 187, successRate: 99 },
  { id: "j2", name: "Weekly Report Generation", description: "Generate and email weekly analytics report", schedule: "0 8 * * 1", scheduleDesc: "Every Monday at 8:00 AM", target: "Analytics Agent", type: "agent", status: "active", lastRun: "2026-06-24 08:00", nextRun: "2026-07-01 08:00", runs: 42, successRate: 100 },
  { id: "j3", name: "Model Cache Refresh", description: "Refresh embedding model cache", schedule: "0 */6 * * *", scheduleDesc: "Every 6 hours", target: "System Maintenance", type: "system", status: "active", lastRun: "2026-06-24 06:00", nextRun: "2026-06-24 12:00", runs: 890, successRate: 95 },
  { id: "j4", name: "Health Check", description: "Run system health diagnostics", schedule: "*/15 * * * *", scheduleDesc: "Every 15 minutes", target: "System Health", type: "system", status: "active", lastRun: "2026-06-24 10:30", nextRun: "2026-06-24 10:45", runs: 4521, successRate: 100 },
  { id: "j5", name: "Database Backup", description: "Backup PostgreSQL database", schedule: "0 2 * * 0", scheduleDesc: "Every Sunday at 2:00 AM", target: "DB Backup Pipeline", type: "pipeline", status: "paused", lastRun: "2026-06-23 02:00", nextRun: "Paused", runs: 24, successRate: 100 },
]

const runHistory: Run[] = [
  { id: "r1", jobId: "j1", started: "2026-06-24 03:00", duration: "2m 34s", status: "success", output: "Ingested 15,234 records from 3 sources" },
  { id: "r2", jobId: "j1", started: "2026-06-23 03:00", duration: "3m 12s", status: "success", output: "Ingested 14,890 records from 3 sources" },
  { id: "r3", jobId: "j3", started: "2026-06-24 06:00", duration: "45s", status: "success", output: "Cache refreshed: 2,341 embeddings updated" },
  { id: "r4", jobId: "j3", started: "2026-06-24 00:00", duration: "1m 02s", status: "failed", output: "Error: Connection timeout to embedding service" },
  { id: "r5", jobId: "j4", started: "2026-06-24 10:30", duration: "3s", status: "success", output: "All systems healthy (12/12 checks passed)" },
  { id: "r6", jobId: "j2", started: "2026-06-24 08:00", duration: "4m 15s", status: "success", output: "Report generated and emailed to 12 recipients" },
]

const cronPresets = [
  { label: "Every 15 min", value: "*/15 * * * *", desc: "Runs 96 times per day" },
  { label: "Every hour", value: "0 * * * *", desc: "Runs 24 times per day" },
  { label: "Every 6 hours", value: "0 */6 * * *", desc: "Runs 4 times per day" },
  { label: "Daily at midnight", value: "0 0 * * *", desc: "Runs once per day" },
  { label: "Daily at 3 AM", value: "0 3 * * *", desc: "Runs once per day" },
  { label: "Weekly on Monday", value: "0 8 * * 1", desc: "Runs once per week" },
  { label: "Monthly 1st", value: "0 0 1 * *", desc: "Runs once per month" },
]

export default function JobsPage() {
  const [jobs, setJobs] = useState(initialJobs)
  const [search, setSearch] = useState("")
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newJobPreset, setNewJobPreset] = useState("0 0 * * *")

  const filtered = jobs.filter((j) => j.name.toLowerCase().includes(search.toLowerCase()))
  const currentJob = selectedJob ? jobs.find((j) => j.id === selectedJob) : null
  const jobRuns = runHistory.filter((r) => r.jobId === selectedJob).slice(0, 10)

  const toggleJob = (id: string) => {
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: j.status === "active" ? "paused" : "active" as const } : j))
  }

  const handleCreate = () => {
    const id = `j${Date.now()}`
    const preset = cronPresets.find((p) => p.value === newJobPreset)
    setJobs((prev) => [{
      id, name: "New Job", description: "Custom scheduled job", schedule: newJobPreset,
      scheduleDesc: preset?.desc ?? "Custom", target: "Pipeline", type: "pipeline",
      status: "active" as const, lastRun: null, nextRun: "Pending", runs: 0, successRate: 100,
    }, ...prev])
    setShowCreate(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-surface">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Automate pipelines, agent tasks, and system maintenance</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{jobs.filter((j) => j.status === "active").length}/{jobs.length} active</Badge>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-3.5 w-3.5" /> New Job
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={cn("xl:col-span-2", !selectedJob && "xl:col-span-3")}>
          {showCreate && (
            <Card className="p-5 mb-4 border-primary/30 bg-primary/[0.02]">
              <h3 className="text-sm font-semibold mb-3">Create Scheduled Job</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Preset Schedule</label>
                  <select value={newJobPreset} onChange={(e) => setNewJobPreset(e.target.value)} className="h-9 text-sm w-full rounded-md border border-input bg-surface px-3">
                    {cronPresets.map((p) => (<option key={p.value} value={p.value}>{p.label} — {p.desc}</option>))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Custom Cron Expression</label>
                  <Input value={newJobPreset} onChange={(e) => setNewJobPreset(e.target.value)} placeholder="*/15 * * * *" className="h-8 text-sm font-mono" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" className="h-8 text-xs" onClick={handleCreate}>Create Job</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {filtered.map((job) => (
              <div key={job.id}
                className={cn("rounded-lg border border-border/50 bg-surface p-4 transition-all cursor-pointer card-hover", selectedJob === job.id && "ring-1 ring-primary/30")}
                onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", job.status === "active" ? "bg-emerald-500/10" : "bg-muted")}>
                      <Clock className={cn("h-4 w-4", job.status === "active" ? "text-emerald-400" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{job.name}</h3>
                      <p className="text-xs text-muted-foreground">{job.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn("text-[10px]", job.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {job.status}
                    </Badge>
                    <button onClick={(e) => { e.stopPropagation(); toggleJob(job.id) }} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      {job.status === "active" ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="font-mono text-primary/80">{job.schedule}</span>
                  <span>{job.scheduleDesc}</span>
                  <span>{job.runs} runs</span>
                  <span className={cn(job.successRate >= 99 ? "text-emerald-400" : "text-amber-400")}>{job.successRate}%</span>
                  <span className="ml-auto">
                    {job.lastRun ? `Last: ${job.lastRun}` : "Never run"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedJob && currentJob && (
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {currentJob.name} — Run History
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {jobRuns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No runs yet</p>
                ) : jobRuns.map((run) => (
                  <div key={run.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border/50 bg-background/30">
                    {run.status === "success" ? <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" /> :
                     run.status === "failed" ? <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" /> :
                     <Loader2 className="h-4 w-4 text-blue-400 mt-0.5 animate-spin shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">{run.output}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                        <span>{run.started}</span>
                        <span>{run.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-2">Job Details</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Schedule", value: currentJob.schedule },
                  { label: "Target", value: currentJob.target },
                  { label: "Type", value: currentJob.type },
                  { label: "Total Runs", value: String(currentJob.runs) },
                  { label: "Success Rate", value: `${currentJob.successRate}%` },
                  { label: "Last Run", value: currentJob.lastRun ?? "N/A" },
                  { label: "Next Run", value: currentJob.nextRun },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><RotateCcw className="h-3 w-3" /> Run Now</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-400 hover:text-red-400"><Trash2 className="h-3 w-3" /> Delete</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
