"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@flowmind/ui"
import { Input } from "@flowmind/ui"
import { Textarea } from "@flowmind/ui"
import { ScrollArea } from "@flowmind/ui"
import { Separator } from "@flowmind/ui"
import { Trash2, X, Settings } from "lucide-react"
import type { Node } from "reactflow"

interface InspectorPanelProps {
  selectedNode: Node | null
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onDeleteNode: (nodeId: string) => void
  onClose: () => void
}

const nodeTypeLabels: Record<string, string> = {
  triggerNode: "Trigger",
  aiNode: "AI Node",
  actionNode: "Action",
  flowNode: "Flow Control",
  integrationNode: "Integration",
}

export function InspectorPanel({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: InspectorPanelProps) {
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (selectedNode) {
      setLabel((selectedNode.data?.label as string) || "")
      setDescription((selectedNode.data?.config as Record<string, unknown>)?.description as string || "")
    }
  }, [selectedNode])

  const handleLabelChange = useCallback(
    (value: string) => {
      setLabel(value)
      if (selectedNode) {
        onUpdateNode(selectedNode.id, { ...selectedNode.data, label: value })
      }
    },
    [selectedNode, onUpdateNode]
  )

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setDescription(value)
      if (selectedNode) {
        onUpdateNode(selectedNode.id, {
          ...selectedNode.data,
          config: { ...(selectedNode.data?.config as Record<string, unknown> || {}), description: value },
        })
      }
    },
    [selectedNode, onUpdateNode]
  )

  const handleDelete = useCallback(() => {
    if (selectedNode) {
      onDeleteNode(selectedNode.id)
    }
  }, [selectedNode, onDeleteNode])

  if (!selectedNode) {
    return (
      <div className="w-72 h-full bg-surface border-l border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Inspector
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            Select a node to inspect
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-72 h-full bg-surface border-l border flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          Inspector
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-accent rounded-md transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Type
            </p>
            <p className="text-xs text-foreground">
              {selectedNode.type ? (nodeTypeLabels[selectedNode.type] || selectedNode.type) : "Unknown"}
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="h-8 text-xs"
              placeholder="Node label"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="min-h-[60px] text-xs"
              placeholder="Node description"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Config
            </label>
            <div className="rounded-md border p-2">
              <p className="text-[10px] text-muted-foreground">
                Node-specific configuration fields will appear here based on the node type.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="w-full gap-1.5 text-xs h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Node
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
