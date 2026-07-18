"use client"

import { type ReactNode, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { Button } from "@/components/ui/button"
import { useSidebarStore } from "@/hooks/sidebar-store"

const noSidebarRoutes = ["/login", "/forgot-password", "/", "/install", "/docs"]

function useResponsiveSidebar() {
  const { setResponsive, setOpen, setMobileOpen, isMobile } = useSidebarStore()

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      const mobile = w < 768
      const tablet = w >= 768 && w < 1024
      setResponsive(mobile, tablet)
      if (mobile) {
        setOpen(false)
        setMobileOpen(false)
      } else if (tablet) {
        setOpen(false)
        setMobileOpen(false)
      } else {
        setOpen(true)
        setMobileOpen(false)
      }
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [setResponsive, setOpen, setMobileOpen])

  return isMobile
}

export function LayoutWithSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { isOpen, isMobileOpen, isMobile, isTablet, setMobileOpen } = useSidebarStore()
  const _isMobile = useResponsiveSidebar()

  if (noSidebarRoutes.includes(pathname)) {
    return (
      <>
        {children}
        <KeyboardShortcuts />
      </>
    )
  }

  const sidebarWidth = isMobile ? 0 : isOpen ? 14 : 3.5

  return (
    <div className="flex min-h-screen">
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {isMobile ? (
        <div
          className={`fixed left-0 top-0 z-40 h-full transition-transform duration-300 ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar />
        </div>
      ) : (
        <Sidebar />
      )}

      {isMobile && !isMobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-3 top-3 z-50 h-9 w-9 bg-surface border shadow-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <main
        className="flex-1 min-w-0 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}rem` }}
      >
        {children}
      </main>
    </div>
  )
}
