"use client"

import { useEffect, useState } from "react"
import { X, Command } from "lucide-react"

interface Shortcut {
  key: string
  description: string
}

const shortcuts: Shortcut[] = [
  { key: "Ctrl+K", description: "Open command palette" },
  { key: "Ctrl+/", description: "Toggle keyboard shortcuts" },
  { key: "Ctrl+B", description: "Toggle sidebar" },
  { key: "Escape", description: "Close dialog / go back" },
  { key: "G then H", description: "Go to Control Center" },
  { key: "G then C", description: "Go to Chat" },
  { key: "G then A", description: "Go to Agents" },
  { key: "G then P", description: "Go to Pipelines" },
  { key: "G then M", description: "Go to Marketplace" },
  { key: "G then S", description: "Go to Settings" },
  { key: "Ctrl+S", description: "Save pipeline (canvas)" },
  { key: "Ctrl+Enter", description: "Run pipeline (canvas)" },
  { key: "Delete", description: "Delete selected node (canvas)" },
  { key: "Ctrl+D", description: "Duplicate selected node (canvas)" },
]

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-dropdown animate-fade-in-up">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Command className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4 max-h-80 overflow-y-auto">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0"
              >
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <kbd className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground font-mono">
                  {shortcut.key.split(" ").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-0.5 text-muted-foreground">then</span>}
                      <span className="px-1">{part}</span>
                    </span>
                  ))}
                </kbd>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">Ctrl+/</kbd> to toggle this overlay
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
