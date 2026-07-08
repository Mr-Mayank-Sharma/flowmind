"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Search, Clock, Play, Square, Calendar, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

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
  const [jobs, setJobs] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newJobPreset, setNewJobPreset] = useState("0 0 * * *")

  const fetchJobs = async () => {
    try {
      const list = await api.jobs.list()
      setJobs(list)
    } catch {}
  }

  useEffect(() => { fetchJobs() }, [])

  const filtered = jobs.filter((j) => j.name.toLowerCase().includes(search.toLowerCase()))
  const currentJob = selectedJob ? jobs.find((j) => j.id === selectedJob) : null

  const toggleJob = async (id: string) => {
    try {
      await api.jobs.toggle(id)
      fetchJobs()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    try {
      await api.jobs.delete(id)
      setSelectedJob(null)
      fetchJobs()
    } catch {}
  }

  const handleCreate = async () => {
    try {
      await api.jobs.create({ name: "New Job", expression: newJobPreset, pipelineId: "manual" })
      setShowCreate(false)
      fetchJobs()
    } catch {}
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
              <Badge variant="secondary" className="text-xs">{jobs.filter((j) => j.isActive).length}/{jobs.length} active</Badge>
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
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", job.isActive ? "bg-emerald-500/10" : "bg-muted")}>
                      <Clock className={cn("h-4 w-4", job.isActive ? "text-emerald-400" : "text-muted-foreground")} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{job.name}</h3>
                      <p className="text-xs text-muted-foreground">Cron: {job.expression}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn("text-[10px]", job.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {job.isActive ? "active" : "paused"}
                    </Badge>
                    <button onClick={(e) => { e.stopPropagation(); toggleJob(job.id) }} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      {job.isActive ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="font-mono text-primary/80">{job.expression}</span>
                  <span>{job.runCount ?? 0} runs</span>
                  <span className="ml-auto">
                    {job.lastRunAt ? `Last: ${new Date(job.lastRunAt).toLocaleString()}` : "Never run"}
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
                {currentJob.name} — Details
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Expression", value: currentJob.expression },
                  { label: "Pipeline ID", value: currentJob.pipelineId },
                  { label: "Channel", value: currentJob.channel ?? "N/A" },
                  { label: "Total Runs", value: String(currentJob.runCount ?? 0) },
                  { label: "Last Run", value: currentJob.lastRunAt ? new Date(currentJob.lastRunAt).toLocaleString() : "N/A" },
                  { label: "Next Run", value: currentJob.nextRunAt ? new Date(currentJob.nextRunAt).toLocaleString() : "N/A" },
                  { label: "Created", value: new Date(currentJob.createdAt).toLocaleDateString() },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-400 hover:text-red-400" onClick={() => handleDelete(currentJob.id)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
