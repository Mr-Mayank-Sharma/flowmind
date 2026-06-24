"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Sparkles, Settings, LogOut, ChevronDown } from "lucide-react"
import { cn, Button } from "@flowmind/ui"

interface User {
  email: string
  name: string
  id: string
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("flowmind_user")
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
  }, [])

  const handleSignOut = () => {
    localStorage.removeItem("flowmind_user")
    document.cookie = "flowmind_session=;path=/;max-age=0"
    setUser(null)
    setMenuOpen(false)
    router.push("/login")
  }

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/")

  const navLinks = user ? [
    { href: "/home", label: "Control Center" },
    { href: "/chat", label: "Chat" },
    { href: "/pipelines", label: "Pipelines" },
    { href: "/marketplace", label: "Marketplace" },
  ] : []

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <Link href="/" className="flex items-center gap-2 mr-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-base font-bold">FlowMind</span>
          </Link>
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  isActive(link.href)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMenuOpen(!menuOpen)}
                className="gap-1.5 text-xs"
              >
                <span className="hidden sm:inline">{user.name}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-surface shadow-lg z-50 py-1">
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                      {user.email}
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-destructive"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : pathname !== "/login" && (
            <Link href="/login">
              <Button size="sm" className="text-xs h-8">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
