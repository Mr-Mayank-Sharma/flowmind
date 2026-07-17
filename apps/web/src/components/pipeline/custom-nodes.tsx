"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { cn } from "@flowmind/ui"
import {
  Clock,
  Webhook,
  MessageSquare,
  MousePointerClick,
  Zap,
  FileText,
  Database,
  GitBranch,
  Globe,
  Image,
  Code,
  Mail,
  SplitSquareHorizontal,
  Merge,
  Repeat,
  ArrowRight,
  AlertTriangle,
} from "lucide-react"

interface BaseNodeData {
  label: string
  icon?: string
  config?: Record<string, unknown>
  status?: "idle" | "running" | "success" | "error" | "cancelled"
  selected?: boolean
}

const iconMap: Record<string, React.ElementType> = {
  Clock,
  Webhook,
  MessageSquare,
  MousePointerClick,
  Zap,
  FileText,
  Database,
  GitBranch,
  Globe,
  Image,
  Code,
  Mail,
  SplitSquareHorizontal,
  Merge,
  Repeat,
  ArrowRight,
  AlertTriangle,
  Workflow: Zap,
}

function StatusDot({ status }: { status?: string }) {
  if (!status || status === "idle") return null
  const colors: Record<string, string> = {
    running: "bg-blue-500 animate-pulse",
    success: "bg-green-500",
    error: "bg-red-500",
    cancelled: "bg-yellow-500",
  }
  return (
    <span
      className={cn(
        "absolute top-1 right-1 h-2 w-2 rounded-full",
        colors[status] || "bg-gray-500"
      )}
    />
  )
}

function NodeHeader({
  label,
  iconName,
  color,
}: {
  label: string
  iconName?: string
  color: string
}) {
  const Icon = iconName ? iconMap[iconName] : null
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-semibold text-white",
        color
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="truncate">{label}</span>
    </div>
  )
}

export const TriggerNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => (
  <div
    className={cn(
      "rounded-lg border bg-surface shadow-sm transition-shadow min-w-[160px]",
      selected && "ring-2 ring-ring shadow-md"
    )}
  >
    <NodeHeader label={data.label} iconName={data.icon} color="bg-emerald-600" />
    <div className="px-3 py-2 text-[11px] text-muted-foreground">
      {data.config?.summary ? String(data.config.summary) : "Configure trigger..."}
    </div>
    <StatusDot status={data.status} />
    <Handle
      type="source"
      position={Position.Bottom}
      className="!bg-emerald-500 !border-2 !border-background !w-3 !h-3"
    />
  </div>
))

TriggerNode.displayName = "TriggerNode"

export const AINode = memo(({ data, selected }: NodeProps<BaseNodeData>) => (
  <div
    className={cn(
      "rounded-lg border bg-surface shadow-sm transition-shadow min-w-[160px]",
      selected && "ring-2 ring-ring shadow-md"
    )}
  >
    <NodeHeader label={data.label} iconName={data.icon} color="bg-violet-600" />
    <div className="px-3 py-2 text-[11px] text-muted-foreground">
      {data.config?.summary ? String(data.config.summary) : "Configure AI node..."}
    </div>
    <StatusDot status={data.status} />
    <Handle
      type="target"
      position={Position.Top}
      className="!bg-violet-500 !border-2 !border-background !w-3 !h-3"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      className="!bg-violet-500 !border-2 !border-background !w-3 !h-3"
    />
  </div>
))

AINode.displayName = "AINode"

export const ActionNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => (
  <div
    className={cn(
      "rounded-lg border bg-surface shadow-sm transition-shadow min-w-[160px]",
      selected && "ring-2 ring-ring shadow-md"
    )}
  >
    <NodeHeader label={data.label} iconName={data.icon} color="bg-blue-600" />
    <div className="px-3 py-2 text-[11px] text-muted-foreground">
      {data.config?.summary ? String(data.config.summary) : "Configure action..."}
    </div>
    <StatusDot status={data.status} />
    <Handle
      type="target"
      position={Position.Top}
      className="!bg-blue-500 !border-2 !border-background !w-3 !h-3"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      className="!bg-blue-500 !border-2 !border-background !w-3 !h-3"
    />
  </div>
))

ActionNode.displayName = "ActionNode"

export const FlowNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => (
  <div
    className={cn(
      "rounded-lg border bg-surface shadow-sm transition-shadow min-w-[160px]",
      selected && "ring-2 ring-ring shadow-md"
    )}
  >
    <NodeHeader label={data.label} iconName={data.icon} color="bg-orange-600" />
    <div className="px-3 py-2 text-[11px] text-muted-foreground">
      {data.config?.summary ? String(data.config.summary) : "Configure flow..."}
    </div>
    <StatusDot status={data.status} />
    <Handle
      type="target"
      position={Position.Top}
      className="!bg-orange-500 !border-2 !border-background !w-3 !h-3"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      className="!bg-orange-500 !border-2 !border-background !w-3 !h-3"
    />
    <Handle
      type="source"
      position={Position.Left}
      id="left"
      className="!bg-orange-500 !border-2 !border-background !w-3 !h-3"
    />
    <Handle
      type="source"
      position={Position.Right}
      id="right"
      className="!bg-orange-500 !border-2 !border-background !w-3 !h-3"
    />
  </div>
))

FlowNode.displayName = "FlowNode"

export const IntegrationNode = memo(({ data, selected }: NodeProps<BaseNodeData>) => (
  <div
    className={cn(
      "rounded-lg border bg-surface shadow-sm transition-shadow min-w-[160px]",
      selected && "ring-2 ring-ring shadow-md"
    )}
  >
    <NodeHeader label={data.label} iconName={data.icon} color="bg-gray-600" />
    <div className="px-3 py-2 text-[11px] text-muted-foreground">
      {data.config?.summary ? String(data.config.summary) : "Configure integration..."}
    </div>
    <StatusDot status={data.status} />
    <Handle
      type="target"
      position={Position.Top}
      className="!bg-gray-500 !border-2 !border-background !w-3 !h-3"
    />
    <Handle
      type="source"
      position={Position.Bottom}
      className="!bg-gray-500 !border-2 !border-background !w-3 !h-3"
    />
  </div>
))

IntegrationNode.displayName = "IntegrationNode"

export const nodeTypes = {
  triggerNode: TriggerNode,
  aiNode: AINode,
  actionNode: ActionNode,
  flowNode: FlowNode,
  integrationNode: IntegrationNode,
}
