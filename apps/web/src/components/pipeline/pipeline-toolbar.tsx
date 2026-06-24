"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@flowmind/ui"
import {
  Save,
  Play,
  Undo2,
  Redo2,
  ChevronLeft,
  Workflow,
} from "lucide-react"
import Link from "next/link"

interface PipelineToolbarProps {
  pipelineId: string
  pipelineName: string
  onNameChange: (name: string) => void
  onSave: () => void
  onRun: () => void
  version: number
}

export function PipelineToolbar({
  pipelineId,
  pipelineName,
  onNameChange,
  onSave,
  onRun,
  version,
}: PipelineToolbarProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pipelineName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(pipelineName)
  }, [pipelineName])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleBlur = useCallback(() => {
    setEditing(false)
    const trimmed = name.trim()
    if (trimmed && trimmed !== pipelineName) {
      onNameChange(trimmed)
    } else {
      setName(pipelineName)
    }
  }, [name, pipelineName, onNameChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        inputRef.current?.blur()
      }
      if (e.key === "Escape") {
        setName(pipelineName)
        setEditing(false)
      }
    },
    [pipelineName]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onSave])

  return (
    <div className="flex items-center justify-between h-11 px-3 border-b bg-surface shrink-0">
      <div className="flex items-center gap-3">
        <Link
          href="/pipelines"
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Workflow className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-7 px-1.5 rounded border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
            >
              {name}
            </button>
          )}
          <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5">
            v{version}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSave}
          className="gap-1.5 text-xs h-8"
        >
          <Save className="h-3.5 w-3.5" />
          Save
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            Ctrl+S
          </span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onRun}
          className="gap-1.5 text-xs h-8"
        >
          <Play className="h-3.5 w-3.5" />
          Run
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="icon" disabled className="h-8 w-8">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled className="h-8 w-8">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
