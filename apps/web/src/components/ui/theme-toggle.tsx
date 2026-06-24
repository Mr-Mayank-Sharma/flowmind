"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "flex items-center gap-3 rounded-md transition-colors w-full",
        "px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent",
        className
      )}
      title="Toggle theme"
    >
      <Sun className="h-4 w-4 shrink-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 shrink-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-0" />
      <span>Toggle theme</span>
    </button>
  )
}
