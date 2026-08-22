import { execSync } from "child_process"
import os from "os"
import { cacheProvider, logger } from "../infrastructure"
import { prisma } from "@flowmind/db"

const IS_WIN = process.platform === "win32"

function run(cmd: string, fallback = ""): string {
  try {
    return execSync(cmd, { timeout: 4000, encoding: "utf-8", shell: IS_WIN ? "powershell.exe" : "/bin/sh" }).trim()
  } catch {
    return fallback
  }
}

let procCache: { at: number; value: RawProcess[] } | null = null

function listRawProcesses(): RawProcess[] {
  if (procCache && Date.now() - procCache.at < 5_000) return procCache.value
  const value = listRawProcessesUncached()
  procCache = { at: Date.now(), value }
  return value
}

function getCPUPercent(): number {
  const cpus = os.cpus()
  let totalIdle = 0, totalTick = 0
  for (const cpu of cpus) {
    for (const key in cpu.times) {
      totalTick += (cpu.times as any)[key]
    }
    totalIdle += cpu.times.idle
  }
  const idle = totalIdle / cpus.length
  const tick = totalTick / cpus.length
  return Math.round((1 - idle / tick) * 100)
}

function getListeningPorts(): number[] {
  const raw = IS_WIN
    ? run("netstat -ano")
    : run("netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null")
  const ports = new Set<number>()
  for (const line of raw.split("\n")) {
    const m = line.match(/:(\d+)\s+\S+\s+(LISTEN|LISTENING)/i)
    if (m) {
      const port = parseInt(m[1]!, 10)
      if (!isNaN(port)) ports.add(port)
    }
  }
  return Array.from(ports)
}

interface DiskSample {
  percent: number
  usedGb: string
  totalGb: string
}

function getDiskUsage(): DiskSample {
  if (IS_WIN) {
    const raw = run("Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Sort-Object Size -Descending | Select-Object -First 1 | ForEach-Object { \"$($_.FreeSpace)|$($_.Size)\" }")
    const match = raw.match(/^(\d+)\|(\d+)$/)
    if (match) {
      const free = parseInt(match[1]!, 10)
      const total = parseInt(match[2]!, 10)
      if (total > 0) {
        const used = total - free
        return {
          percent: Math.round((used / total) * 100),
          usedGb: (used / 1024 / 1024 / 1024).toFixed(1),
          totalGb: (total / 1024 / 1024 / 1024).toFixed(1),
        }
      }
    }
    return { percent: 0, usedGb: "0", totalGb: "0" }
  }

  const raw = run("df -B1 / 2>/dev/null | tail -1")
  const parts = raw.split(/\s+/)
  const total = parseInt(parts[1] ?? "", 10)
  const used = parseInt(parts[2] ?? "", 10)
  if (total > 0) {
    return {
      percent: Math.round((used / total) * 100),
      usedGb: (used / 1024 / 1024 / 1024).toFixed(1),
      totalGb: (total / 1024 / 1024 / 1024).toFixed(1),
    }
  }
  return { percent: 0, usedGb: "0", totalGb: "0" }
}

function getGPUInfo(): { index: number; name: string; utilization: number; memoryUtil: number; temperature: number; vramTotal: string; vramUsed: string }[] {
  const raw = run("nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader 2>/dev/null")
  if (!raw) return []
  return raw.split("\n").filter(Boolean).map((line) => {
    const parts = line.split(", ")
    const vramUsedMiB = parseInt((parts[3] ?? "0").replace(" MiB", ""), 10) || 0
    const vramTotalMiB = parseInt((parts[4] ?? "1").replace(" MiB", ""), 10) || 1
    return {
      index: parseInt(parts[0] ?? "", 10) || 0,
      name: parts[1] || "Unknown GPU",
      utilization: parseInt(parts[2] ?? "", 10) || 0,
      memoryUtil: Math.round((vramUsedMiB / vramTotalMiB) * 100),
      temperature: parseInt(parts[5] ?? "", 10) || 0,
      vramTotal: parts[4] || "0 MiB",
      vramUsed: parts[3] || "0 MiB",
    }
  })
}

interface NetSample {
  rxBytes: number
  txBytes: number
  timestamp: number
}

let lastNetSample: NetSample | null = null

function getNetBytes(): NetSample {
  if (IS_WIN) {
    const raw = run("Get-NetAdapterStatistics | Measure-Object -Property ReceivedBytes -Sum -ErrorAction SilentlyContinue | Select-Object @{n='r';e={$_.Sum}} | ForEach-Object { $r=$_.r; $t=(Get-NetAdapterStatistics | Measure-Object -Property SentBytes -Sum -ErrorAction SilentlyContinue).Sum; \"$r|$t\" }")
    const match = raw.match(/^(\d+)\|(\d+)$/)
    if (match) {
      return { rxBytes: parseInt(match[1]!, 10), txBytes: parseInt(match[2]!, 10), timestamp: Date.now() }
    }
    return { rxBytes: 0, txBytes: 0, timestamp: Date.now() }
  }

  const raw = run("cat /proc/net/dev 2>/dev/null | grep -E 'eth0|wlan0|enp|wlp|ens|bond' | awk -F: '{print $2}'")
  let rxBytes = 0
  let txBytes = 0
  for (const line of raw.split("\n")) {
    const parts = line.trim().split(/\s+/)
    rxBytes += parseInt(parts[0] ?? "", 10) || 0
    txBytes += parseInt(parts[8] ?? "", 10) || 0
  }
  return { rxBytes, txBytes, timestamp: Date.now() }
}

function getNetworkUsage(): { upMbps: string; downMbps: string } {
  const sample = getNetBytes()
  if (lastNetSample && sample.timestamp > lastNetSample.timestamp) {
    const seconds = (sample.timestamp - lastNetSample.timestamp) / 1000
    if (seconds > 0) {
      const down = ((sample.rxBytes - lastNetSample.rxBytes) * 8) / seconds / 1_000_000
      const up = ((sample.txBytes - lastNetSample.txBytes) * 8) / seconds / 1_000_000
      lastNetSample = sample
      return {
        downMbps: Math.max(0, down).toFixed(1),
        upMbps: Math.max(0, up).toFixed(1),
      }
    }
  }
  lastNetSample = sample
  return { upMbps: "0.0", downMbps: "0.0" }
}

export interface SystemMetrics {
  cpuPercent: number
  ramPercent: number
  ramUsedGb: string
  ramTotalGb: string
  gpuPercent: number | null
  gpuTemp: number | null
  vramUsedGb: string | null
  vramTotalGb: string | null
  diskPercent: number
  diskUsedGb: string
  diskTotalGb: string
  networkUpMbps: string
  networkDownMbps: string
  processes: number
  loadAvg: string
  uptime: string
  servicesRunning: number
  servicesTotal: number
}

export interface FrameworkInfo {
  id: string
  name: string
  icon: string
  status: "running" | "stopped" | "error"
  port: number
  version: string
  pid: number | null
  models: number
  description: string
  category: string
}

export interface ProcessInfo {
  pid: number
  name: string
  status: string
  cpu: string
  ram: string
  ramBytes: number
  user: string
  uptime: string
  command: string
  port: number | null
}

interface RawProcess {
  pid: number
  name: string
  cpu: number
  ramBytes: number
  user: string
  startMs: number
  command: string
}

function listRawProcessesUncached(): RawProcess[] {
  if (IS_WIN) {
    let raw = ""
    try {
      raw = execSync("Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64,StartTime,Path | ConvertTo-Csv -NoTypeInformation", { timeout: 20000, encoding: "utf-8", shell: "powershell.exe" }).trim()
    } catch {
      return []
    }
    const rows = raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
    const now = Date.now()
    const out: RawProcess[] = []
    for (let i = 1; i < rows.length; i++) {
      const parts = rows[i]!.split(",").map((p) => p.replace(/"/g, "").trim())
      const pid = parseInt(parts[0] ?? "", 10)
      if (isNaN(pid)) continue
      const cpu = parseFloat(parts[2] ?? "") || 0
      const ramBytes = parseInt(parts[3] ?? "", 10) || 0
      const startRaw = parts[4] ?? ""
      const startMs = startRaw ? new Date(startRaw).getTime() : now
      out.push({
        pid,
        name: parts[1] || "unknown",
        cpu,
        ramBytes,
        user: os.userInfo().username,
        startMs: isNaN(startMs) ? now : startMs,
        command: parts[5] || parts[1] || "unknown",
      })
    }
    return out
  }

  const raw = run("ps -eo pid,pcpu,rss,user,lstart,comm,args --no-headers 2>/dev/null", "")
  const now = Date.now()
  const out: RawProcess[] = []
  for (const line of raw.split("\n")) {
    const parts = line.trim().split(/\s+/)
    const pid = parseInt(parts[0] ?? "", 10)
    if (isNaN(pid)) continue
    // lstart format: "Wed Jan  1 12:00:00 2025" -> 5 words; args begins after that
    const lstart = parts.slice(4, 9).join(" ")
    const startMs = Date.parse(lstart)
    out.push({
      pid,
      name: (parts[9] ?? "unknown").split("/").pop() ?? "unknown",
      cpu: parseFloat(parts[1] ?? "") || 0,
      ramBytes: (parseInt(parts[2] ?? "", 10) || 0) * 1024,
      user: parts[3] || "unknown",
      startMs: isNaN(startMs) ? now : startMs,
      command: parts.slice(9).join(" ") || "unknown",
    })
  }
  return out
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${h}h ${m}m`
}

export class MetricsService {
  async getMetrics(): Promise<SystemMetrics> {
    const cached = cacheProvider.get<SystemMetrics>("system:metrics")
    if (cached) return cached
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const ramPercent = Math.round((usedMem / totalMem) * 100)
    const ramUsedGb = (usedMem / 1024 / 1024 / 1024).toFixed(1)
    const ramTotalGb = (totalMem / 1024 / 1024 / 1024).toFixed(1)

    const disk = getDiskUsage()
    const gpus = getGPUInfo()
    const net = getNetworkUsage()
    const loadAvg = os.loadavg()
    const processes = listRawProcesses()
    const uptime = os.uptime()
    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`

    const frameworks = await this.getFrameworks()
    const servicesRunning = frameworks.filter((f) => f.status === "running").length

    const metrics: SystemMetrics = {
      cpuPercent: getCPUPercent(),
      ramPercent,
      ramUsedGb,
      ramTotalGb,
      gpuPercent: gpus[0]?.utilization ?? null,
      gpuTemp: gpus[0]?.temperature ?? null,
      vramUsedGb: gpus[0] ? (parseInt(gpus[0].vramUsed) / 1024).toFixed(1) : null,
      vramTotalGb: gpus[0] ? (parseInt(gpus[0].vramTotal) / 1024).toFixed(1) : null,
      diskPercent: disk.percent,
      diskUsedGb: disk.usedGb,
      diskTotalGb: disk.totalGb,
      networkUpMbps: net.upMbps,
      networkDownMbps: net.downMbps,
      processes: processes.length,
      loadAvg: `${(loadAvg[0] ?? 0).toFixed(2)}, ${(loadAvg[1] ?? 0).toFixed(2)}, ${(loadAvg[2] ?? 0).toFixed(2)}`,
      uptime: uptimeStr,
      servicesRunning,
      servicesTotal: frameworks.length,
    }

    cacheProvider.set("system:metrics", metrics, 5_000)
    return metrics
  }

  async getFrameworks(): Promise<FrameworkInfo[]> {
    const cached = cacheProvider.get<FrameworkInfo[]>("system:frameworks")
    if (cached) return cached
    const portSet = new Set(getListeningPorts())
    const processes = listRawProcesses()

    const candidates: FrameworkInfo[] = [
      { id: "ollama", name: "Ollama", icon: "ollama", status: "stopped", port: 11434, version: "0.23.2", pid: null, models: 0, description: "Local LLM inference server", category: "LLM" },
      { id: "lm-studio", name: "LM Studio", icon: "lm-studio", status: "stopped", port: 1234, version: "0.2.29", pid: null, models: 0, description: "Desktop LLM runtime", category: "LLM" },
      { id: "comfyui", name: "ComfyUI", icon: "comfyui", status: "stopped", port: 8188, version: "0.2.4", pid: null, models: 0, description: "Node-based SD workflow engine", category: "Image" },
      { id: "openclaw", name: "OpenClaw", icon: "openclaw", status: "stopped", port: 18789, version: "1.2.0", pid: null, models: 0, description: "Agent orchestration framework", category: "Agent" },
      { id: "hermes", name: "Hermes Agent", icon: "hermes", status: "stopped", port: 3002, version: "2.1.5", pid: null, models: 0, description: "AI agent runtime", category: "Agent" },
      { id: "opencode", name: "OpenCode", icon: "opencode", status: "stopped", port: 8081, version: "0.8.3", pid: null, models: 0, description: "AI coding assistant", category: "Dev Tools" },
      { id: "sd", name: "Stable Diffusion", icon: "sd", status: "stopped", port: 7860, version: "1.9.4", pid: null, models: 0, description: "Text-to-image generation", category: "Image" },
      { id: "localai", name: "LocalAI", icon: "localai", status: "stopped", port: 8080, version: "2.17.1", pid: null, models: 0, description: "OpenAI-compatible local API", category: "LLM" },
    ]

    const cmdIndex = processes.reduce((acc, p) => {
      const cmd = p.command.toLowerCase()
      if (cmd) acc.push({ pid: p.pid, cmd })
      return acc
    }, [] as { pid: number; cmd: string }[])

    for (const fw of candidates) {
      if (portSet.has(fw.port)) {
        fw.status = "running"
      }
      const match = cmdIndex.find((p) => p.cmd.includes(fw.id))
      if (match && !fw.pid) {
        fw.status = "running"
        fw.pid = match.pid
      }
    }

    if (portSet.has(11434)) {
      const ollama = candidates.find((c) => c.id === "ollama")!
      ollama.status = "running"
      const procMatch = processes.find((p) => p.name.toLowerCase().includes("ollama") || p.command.toLowerCase().includes("ollama"))
      if (procMatch) ollama.pid = procMatch.pid
      try {
        const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = (await res.json()) as { models?: Array<{ name: string }> }
          ollama.models = data.models?.length ?? 0
        }
      } catch {}
      ollama.version = run(IS_WIN ? "ollama --version" : "ollama --version 2>/dev/null || echo '0.23.2'", "0.23.2")
    }

    cacheProvider.set("system:frameworks", candidates, 10_000)
    return candidates
  }

  getGPUInfo() {
    return getGPUInfo().map((g) => ({
      id: `gpu${g.index}`,
      name: g.name,
      utilization: g.utilization,
      memoryUtil: g.memoryUtil,
      temperature: g.temperature,
      vramTotal: g.vramTotal,
      vramUsed: g.vramUsed,
    }))
  }

  listProcesses(): ProcessInfo[] {
    const processes = listRawProcesses()
    const pidToPort = new Map<number, number>()
    if (IS_WIN) {
      const raw = run("netstat -ano")
      for (const line of raw.split("\n")) {
        const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i)
        if (m) pidToPort.set(parseInt(m[2]!, 10), parseInt(m[1]!, 10))
      }
    }
    return processes.map((p) => {
      const upMs = Date.now() - p.startMs
      return {
        pid: p.pid,
        name: p.name,
        status: "running",
        cpu: p.cpu.toFixed(1),
        ram: `${(p.ramBytes / 1_000_000_000).toFixed(1)} GB`,
        ramBytes: p.ramBytes,
        user: p.user,
        uptime: formatUptime(upMs),
        command: p.command,
        port: pidToPort.get(p.pid) ?? null,
      }
    })
  }

  killProcess(pid: number, signal = "SIGTERM"): { success: boolean; message: string } {
    try {
      if (IS_WIN) {
        run(`Stop-Process -Id ${pid} -Force -ErrorAction Stop`)
      } else {
        run(`kill -${signal === "SIGKILL" ? 9 : 15} ${pid} 2>/dev/null`)
      }
      logger.info(`Process ${pid} killed with ${signal}`)
      return { success: true, message: `Process ${pid} killed with ${signal}` }
    } catch {
      return { success: false, message: `Failed to kill process ${pid}` }
    }
  }

  startFramework(id: string): { success: boolean; message: string } {
    const commands: Record<string, string> = {
      ollama: IS_WIN ? 'Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden' : "nohup ollama serve > /dev/null 2>&1 &",
    }
    const cmd = commands[id]
    if (!cmd) throw new Error(`No start command configured for ${id}`)
    run(cmd)
    logger.info(`Framework started: ${id}`)
    return { success: true, message: `${id} started` }
  }

  stopFramework(id: string): { success: boolean; message: string } {
    const pids: Record<string, string> = {
      ollama: IS_WIN
        ? "Get-Process | Where-Object { $_.ProcessName -like '*ollama*' } | ForEach-Object { $_.Id }"
        : "pgrep -x ollama",
    }
    const pidCmd = pids[id]
    if (!pidCmd) throw new Error(`No stop command configured for ${id}`)
    const pid = run(pidCmd, "")
    if (pid) {
      if (IS_WIN) {
        const pidList = pid.split("\n").map((p) => p.trim()).filter(Boolean)
        for (const p of pidList) run(`Stop-Process -Id ${p} -Force -ErrorAction SilentlyContinue`)
      } else {
        run(`kill ${pid} 2>/dev/null`)
      }
      logger.info(`Framework stopped: ${id} (PID ${pid})`)
      return { success: true, message: `${id} (PID ${pid}) stopped` }
    }
    return { success: false, message: `${id} not running` }
  }

  async getRecentActivity(limit = 8) {
    const now = Date.now()
    const entries: Array<{ id: string; type: "success" | "info" | "warning" | "error"; message: string; time: string; timestamp: string }> = []

    try {
      const [recentRuns, recentSessions, recentSkills, recentFlows] = await Promise.all([
        prisma.pipelineRun.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { pipeline: { select: { name: true } } },
        }),
        prisma.session.findMany({
          orderBy: { createdAt: "desc" },
          take: Math.min(limit, 4),
          select: { id: true, createdAt: true, title: true },
        }),
        prisma.skill.findMany({
          orderBy: { createdAt: "desc" },
          take: Math.min(limit, 3),
          select: { id: true, name: true, createdAt: true },
        }),
        prisma.marketplaceFlow.findMany({
          orderBy: { createdAt: "desc" },
          take: Math.min(limit, 3),
          select: { id: true, title: true, createdAt: true },
        }),
      ])

      for (const run of recentRuns) {
        const pipelineName = run.pipeline?.name ?? "Unknown"
        const minsAgo = Math.max(1, Math.floor((now - run.createdAt.getTime()) / 60000))
        entries.push({
          id: `run-${run.id}`,
          type: run.status === "SUCCESS" ? "success" : run.status === "FAILED" ? "error" : "info",
          message: `Pipeline "${pipelineName}" ${run.status.toLowerCase()}`,
          time: minsAgo < 60 ? `${minsAgo} min ago` : `${Math.floor(minsAgo / 60)}h ago`,
          timestamp: run.createdAt.toISOString(),
        })
      }

      for (const session of recentSessions) {
        const minsAgo = Math.max(1, Math.floor((now - session.createdAt.getTime()) / 60000))
        entries.push({
          id: `session-${session.id}`,
          type: "info",
          message: session.title ? `Chat: "${session.title}"` : "New chat session started",
          time: minsAgo < 60 ? `${minsAgo} min ago` : `${Math.floor(minsAgo / 60)}h ago`,
          timestamp: session.createdAt.toISOString(),
        })
      }

      for (const skill of recentSkills) {
        const minsAgo = Math.max(1, Math.floor((now - skill.createdAt.getTime()) / 60000))
        entries.push({
          id: `skill-${skill.id}`,
          type: "success",
          message: `Skill "${skill.name}" installed`,
          time: minsAgo < 60 ? `${minsAgo} min ago` : `${Math.floor(minsAgo / 60)}h ago`,
          timestamp: skill.createdAt.toISOString(),
        })
      }

      for (const flow of recentFlows) {
        const minsAgo = Math.max(1, Math.floor((now - flow.createdAt.getTime()) / 60000))
        entries.push({
          id: `flow-${flow.id}`,
          type: "success",
          message: `Flow "${flow.title}" published to marketplace`,
          time: minsAgo < 60 ? `${minsAgo} min ago` : `${Math.floor(minsAgo / 60)}h ago`,
          timestamp: flow.createdAt.toISOString(),
        })
      }
    } catch (e) {
      logger.warn("Failed to fetch real activity from DB, using fallback")
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return entries.slice(0, limit)
  }
}

export const metricsService = new MetricsService()
