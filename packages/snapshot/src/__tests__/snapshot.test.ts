import { describe, it, expect, vi, beforeEach } from "vitest"
import { SnapshotManager } from "../index"

vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}))

vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(""),
  },
}))

describe("SnapshotManager", () => {
  let manager: SnapshotManager
  const testDir = "/tmp/test-snapshots"
  let fs: typeof import("fs").default

  beforeEach(async () => {
    vi.clearAllMocks()
    fs = (await import("fs")).default
    manager = new SnapshotManager(testDir)
    manager.init()
  })

  describe("track", () => {
    it("throws when file not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      await expect(manager.track("nonexistent.ts")).rejects.toThrow("File not found")
    })

    it("creates a snapshot for an existing file", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue("const x = 1")
      const id = await manager.track("file.ts", "test snapshot")
      expect(id).toMatch(/^snap_/)
      expect(manager.getHistory()).toHaveLength(1)
    })
  })

  describe("createPatch", () => {
    it("returns a unified diff", async () => {
      const patch = await manager.createPatch("file.ts", "old content", "new content")
      expect(patch).toContain("---")
      expect(patch).toContain("+++")
      expect(patch).toContain("old content")
      expect(patch).toContain("new content")
    })
  })

  describe("getHistory", () => {
    it("returns empty array initially", () => {
      expect(manager.getHistory()).toHaveLength(0)
    })

    it("returns all snapshots", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue("content")
      await manager.track("a.ts")
      await manager.track("b.ts")
      expect(manager.getHistory()).toHaveLength(2)
    })

    it("filters by file path", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue("content")
      await manager.track("a.ts")
      await manager.track("b.ts")
      const history = manager.getHistory("a.ts")
      expect(history).toHaveLength(1)
    })
  })

  describe("cleanup", () => {
    it("removes old snapshots", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue("content")
      await manager.track("file.ts")
      expect(manager.getHistory()).toHaveLength(1)

      manager.cleanup(0)
      expect(manager.getHistory()).toHaveLength(0)
    })
  })

  describe("revert", () => {
    it("throws when no snapshots", async () => {
      await expect(manager.revert()).rejects.toThrow("No snapshots to revert")
    })
  })
})
