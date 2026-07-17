"use client"

import { useEffect, useCallback } from "react"

interface CanvasShortcuts {
  onSave: () => void
  onRun: () => void
  onDelete: (nodeIds: string[]) => void
  onDuplicate: (nodeIds: string[]) => void
  onSelectAll: () => void
  onDeselect: () => void
  getSelectedNodeIds: () => string[]
}

export function useCanvasShortcuts({
  onSave,
  onRun,
  onDelete,
  onDuplicate,
  onSelectAll,
  onDeselect,
  getSelectedNodeIds,
}: CanvasShortcuts) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return

      const isMeta = e.metaKey || e.ctrlKey
      const selectedIds = getSelectedNodeIds()

      if (isMeta && e.key === "s") {
        e.preventDefault()
        onSave()
        return
      }

      if (isMeta && e.key === "Enter") {
        e.preventDefault()
        onRun()
        return
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        e.preventDefault()
        onDelete(selectedIds)
        return
      }

      if (isMeta && e.key === "d") {
        e.preventDefault()
        if (selectedIds.length > 0) onDuplicate(selectedIds)
        return
      }

      if (isMeta && e.key === "a") {
        e.preventDefault()
        onSelectAll()
        return
      }

      if (e.key === "Escape") {
        onDeselect()
        return
      }
    },
    [onSave, onRun, onDelete, onDuplicate, onSelectAll, onDeselect, getSelectedNodeIds]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

export const SHORTCUTS = [
  { keys: "Ctrl+S", label: "Save pipeline" },
  { keys: "Ctrl+Enter", label: "Run pipeline" },
  { keys: "Delete", label: "Delete selected nodes" },
  { keys: "Ctrl+D", label: "Duplicate selected nodes" },
  { keys: "Ctrl+A", label: "Select all nodes" },
  { keys: "Esc", label: "Deselect all" },
] as const
