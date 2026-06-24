"use client"

import { type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts"
import { useSidebarStore } from "@/hooks/sidebar-store"

const noSidebarRoutes = ["/login", "/forgot-password", "/", "/install", "/docs"]

export function LayoutWithSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { isOpen } = useSidebarStore()

  if (noSidebarRoutes.includes(pathname)) {
    return (
      <>
        {children}
        <KeyboardShortcuts />
      </>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-w-0 transition-all duration-300"
        style={{ marginLeft: isOpen ? "14rem" : "3.5rem" }}
      >
        {children}
      </main>
    </div>
  )
}
