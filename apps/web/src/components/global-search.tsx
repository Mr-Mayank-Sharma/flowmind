"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

const pages = [
  { href: "/home", label: "Home" },
  { href: "/chat", label: "Chat" },
  { href: "/agents", label: "Agents" },
  { href: "/pipelines", label: "Pipelines" },
  { href: "/models", label: "Models" },
  { href: "/mcp", label: "MCP" },
  { href: "/context", label: "Context" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/governance", label: "Governance" },
  { href: "/settings", label: "Settings" },
]



type Result = { href: string; label: string; category: string }

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allResults: Result[] = [
    ...pages.map((p) => ({ ...p, category: "Pages" })),
  ]

  const filtered = query.trim()
    ? allResults.filter(
        (r) =>
          r.label.toLowerCase().includes(query.toLowerCase()) ||
          r.href.toLowerCase().includes(query.toLowerCase())
      )
    : allResults

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        router.push(filtered[selectedIndex].href)
        setOpen(false)
      }
    },
    [filtered, selectedIndex, router]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              No results found.
            </p>
          )}
          {filtered.map((result, index) => (
            <button
              key={result.href}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
                index === selectedIndex
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              onClick={() => {
                router.push(result.href)
                setOpen(false)
              }}
            >
              <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">
                {result.category}
              </span>
              <span>{result.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
