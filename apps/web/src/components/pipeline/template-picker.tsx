"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@flowmind/ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  FileText,
  Search,
  Mail,
  Code,
  Database,
} from "lucide-react"
import { pipelineTemplates, type PipelineTemplate } from "@/lib/pipeline-templates"

const iconMap: Record<string, React.ElementType> = {
  FileText,
  Search,
  Mail,
  Code,
  Database,
}

interface TemplatePickerProps {
  open: boolean
  onClose: () => void
  onSelect: (template: PipelineTemplate) => void
}

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [search, setSearch] = useState("")

  if (!open) return null

  const filtered = search.trim()
    ? pipelineTemplates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      )
    : pipelineTemplates

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-xl border w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Create New Pipeline</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a template or start from scratch
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((template) => {
              const Icon = iconMap[template.icon] || FileText
              return (
                <button
                  key={template.id}
                  onClick={() => onSelect(template)}
                  className={cn(
                    "text-left p-4 rounded-lg border bg-surface hover:border-primary/50 hover:bg-accent/50 transition-all group",
                    template.id === "blank" && "border-dashed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">
                        {template.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        {template.nodes.length === 0
                          ? "Empty canvas"
                          : `${template.nodes.length} nodes`}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                No templates match your search
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
