"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Sparkles,
  MessageSquare,
  GitBranch,
  LayoutDashboard,
  Store,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Bot,
  Cpu,
  Server,
  Brain,
  Shield,
  ChevronDown,
  Keyboard,
  Layers,
  Gauge,
  Folder,
  ListChecks,
  Book,
  Clock,
  Wrench,
  Terminal,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSidebarStore } from "@/hooks/sidebar-store"
import { useAuth } from "@/hooks/use-auth"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { NotificationCenter } from "@/components/notification-center"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"

const navItems = [
  { href: "/home", label: "Control Center", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch },
  { href: "/frameworks", label: "Framework Hub", icon: Layers },
  { href: "/models", label: "Model Hub", icon: Cpu },
  { href: "/mcp", label: "MCP Hub", icon: Server },
  { href: "/knowledge", label: "Knowledge Base", icon: Book },
  { href: "/tools", label: "Tool Registry", icon: Wrench },
  { href: "/tools-v2", label: "Developer Tools", icon: Terminal },
  { href: "/jobs", label: "Scheduled Jobs", icon: Clock },
  { href: "/context", label: "Context Engine", icon: Brain },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/system", label: "System Monitor", icon: Gauge },
  { href: "/processes", label: "Process Manager", icon: ListChecks },
  { href: "/files", label: "File Browser", icon: Folder },
  { href: "/playground", label: "API Playground", icon: Terminal },
  { href: "/docs", label: "Documentation", icon: Book },
  { href: "/governance", label: "Governance", icon: Shield },
  { href: "/workspace", label: "Cloud Console", icon: Building2 },
]

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen, toggle } = useSidebarStore()
  const { user, logout } = useAuth()

  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSignOut = () => {
    logout()
    router.push("/login")
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-full border-r border-border bg-surface transition-all duration-300 flex flex-col",
          isOpen ? "w-56" : "w-14"
        )}
      >
        <div className={cn("flex items-center h-14 border-b border-border gap-1", isOpen ? "px-3 justify-between" : "justify-center")}>
          {isOpen ? (
            <>
              <Link href="/" className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary shrink-0" />
                <span className="font-bold text-sm">FlowMind</span>
              </Link>
              <div className="flex items-center gap-0.5">
                <NotificationCenter />
                <Button variant="ghost" size="icon" onClick={toggle} className="h-7 w-7">
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
                <PanelLeft className="h-4 w-4" />
              </Button>
              <NotificationCenter />
            </div>
          )}
        </div>

        <nav className="flex-1 flex flex-col py-2 gap-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md transition-colors",
                  isOpen ? "px-3 py-2 text-sm" : "justify-center p-2",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className={cn("shrink-0", isOpen ? "h-4 w-4" : "h-5 w-5")} />
                {isOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border py-2 px-2 space-y-0.5">
          {bottomItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md transition-colors",
                  isOpen ? "px-3 py-2 text-sm" : "justify-center p-2",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className={cn("shrink-0", isOpen ? "h-4 w-4" : "h-5 w-5")} />
                {isOpen && <span>{item.label}</span>}
              </Link>
            )
          })}

          {isOpen && <ThemeToggle />}
          {!isOpen && (
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full"
              title="Keyboard shortcuts"
            >
              <Keyboard className="h-5 w-5" />
            </button>
          )}

          {user && isOpen && (
            <div className="px-3 py-2 mt-1 border-t border-border space-y-2">
              <div>
                <p className="text-sm font-medium truncate">{user.name ?? user.email}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {user.role}
                </Badge>
              </div>
              <button className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <span className="truncate">FlowMind Inc.</span>
                <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
              </button>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-3 rounded-md transition-colors w-full text-destructive hover:bg-destructive/10",
              isOpen ? "px-3 py-2 text-sm" : "justify-center p-2"
            )}
            title={!isOpen ? "Log Out" : undefined}
          >
            <LogOut className={cn("shrink-0", isOpen ? "h-4 w-4" : "h-5 w-5")} />
            {isOpen && <span>Log Out</span>}
          </button>
        </div>

        {showShortcuts && <KeyboardShortcuts />}
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={toggle}
        />
      )}
    </>
  )
}
