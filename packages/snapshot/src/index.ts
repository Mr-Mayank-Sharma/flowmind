import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { createTwoFilesPatch, parsePatch, applyPatch } from "diff"

interface Snapshot {
  id: string
  timestamp: number
  files: string[]
  description?: string
}

interface Checkpoint {
  hash: string
  files: string[]
}

export class SnapshotManager {
  private snapshots: Snapshot[] = []
  private checkpoints: Checkpoint[] = []
  private rootPath: string

  constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  init(): void {
    this.snapshots = []
    this.checkpoints = []
  }

  async track(filePath: string, description?: string): Promise<string> {
    const resolvedPath = path.resolve(this.rootPath, filePath)
    if (!fs.existsSync(resolvedPath)) throw new Error(`File not found: ${filePath}`)

    const content = fs.readFileSync(resolvedPath, "utf-8")
    const hash = this.hashContent(content)
    const id = `snap_${Date.now()}_${this.snapshots.length}`

    this.snapshots.push({ id, timestamp: Date.now(), files: [resolvedPath], description })
    this.checkpoints.push({ hash, files: [resolvedPath] })

    return id
  }

  async createPatch(filePath: string, oldContent: string, newContent: string): Promise<string> {
    const patch = createTwoFilesPatch(filePath, filePath, oldContent, newContent, "", "")
    return patch
  }

  async restore(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId)
    if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`)

    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      const snap = this.snapshots[i]
      if (!snap) continue
      if (snap.timestamp <= snapshot.timestamp) break

      for (const filePath of snap.files) {
        if (fs.existsSync(filePath)) {
          try {
            execSync(`git checkout -- "${filePath}"`, { cwd: this.rootPath, stdio: "pipe" })
          } catch {}
        }
      }
    }

    return true
  }

  async revert(): Promise<boolean> {
    const last = this.snapshots.pop()
    if (!last) throw new Error("No snapshots to revert")
    this.checkpoints.pop()

    for (const filePath of last.files) {
      try {
        execSync(`git checkout -- "${filePath}"`, { cwd: this.rootPath, stdio: "pipe" })
      } catch {}
    }
    return true
  }

  async diff(filePath: string): Promise<string> {
    const resolvedPath = path.resolve(this.rootPath, filePath)
    if (!fs.existsSync(resolvedPath)) return ""

    try {
      const output = execSync(`git diff -- "${filePath}"`, {
        cwd: this.rootPath,
        encoding: "utf-8",
        stdio: "pipe",
      })
      return output.trim()
    } catch {
      return ""
    }
  }

  getHistory(filePath?: string): Snapshot[] {
    if (filePath) {
      const resolved = path.resolve(this.rootPath, filePath)
      return this.snapshots.filter((s) => s.files.includes(resolved))
    }
    return [...this.snapshots]
  }

  cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    this.snapshots = this.snapshots.filter((s) => now - s.timestamp < maxAgeMs)
  }

  private hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }
}

export function createSnapshotManager(rootPath: string): SnapshotManager {
  return new SnapshotManager(rootPath)
}
